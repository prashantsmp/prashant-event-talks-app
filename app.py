import re
import time
import requests
import xml.etree.ElementTree as ET
from flask import Flask, render_template, jsonify, request
from bs4 import BeautifulSoup

app = Flask(__name__)

# Simple in-memory cache
cache = {
    'data': None,
    'last_updated': 0
}
CACHE_DURATION = 300 # 5 minutes

def parse_release_notes():
    url = "https://docs.cloud.google.com/feeds/bigquery-release-notes.xml"
    response = requests.get(url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
    response.raise_for_status()
    
    root = ET.fromstring(response.content)
    ns = {'atom': 'http://www.w3.org/2005/Atom'}
    
    entries = []
    
    for entry in root.findall('atom:entry', ns):
        title = entry.find('atom:title', ns).text # e.g. "June 17, 2026"
        updated = entry.find('atom:updated', ns).text
        link_elem = entry.find('atom:link[@rel="alternate"]', ns)
        link = link_elem.attrib.get('href') if link_elem is not None else ""
        content_elem = entry.find('atom:content', ns)
        content_html = content_elem.text if content_elem is not None else ""
        
        soup = BeautifulSoup(content_html, 'html.parser')
        headers = soup.find_all(['h3', 'h4', 'h2'])
        
        if not headers:
            text_content = soup.get_text(separator=' ').strip()
            entries.append({
                'date': title,
                'updated': updated,
                'type': 'General',
                'html': content_html,
                'text': text_content,
                'link': link
            })
        else:
            for i, header in enumerate(headers):
                update_type = header.get_text().strip()
                update_html_parts = [str(header)]
                
                sibling = header.next_sibling
                while sibling and sibling.name not in ['h3', 'h4', 'h2']:
                    update_html_parts.append(str(sibling))
                    sibling = sibling.next_sibling
                
                update_html = "".join(update_html_parts)
                sub_soup = BeautifulSoup(update_html, 'html.parser')
                
                # Extract paragraph texts cleanly
                p_texts = [p.get_text().strip() for p in sub_soup.find_all(['p', 'li'])]
                if p_texts:
                    text_content = " ".join(p_texts)
                else:
                    text_content = sub_soup.get_text(separator=' ').strip()
                    if text_content.startswith(update_type):
                        text_content = text_content[len(update_type):].strip()
                
                text_content = re.sub(r'\s+', ' ', text_content)
                
                entries.append({
                    'date': title,
                    'updated': updated,
                    'type': update_type,
                    'html': update_html,
                    'text': text_content,
                    'link': link # Link to the specific date section
                })
                
    return entries

@app.route('/')
def index():
    return render_template('index.html')

@app.route('/api/notes')
def get_notes():
    force_refresh = request.args.get('force', 'false').lower() == 'true'
    current_time = time.time()
    
    if force_refresh or cache['data'] is None or (current_time - cache['last_updated'] > CACHE_DURATION):
        try:
            notes = parse_release_notes()
            cache['data'] = notes
            cache['last_updated'] = current_time
        except Exception as e:
            # If fetch fails, return cached data if available along with error details,
            # otherwise return error
            if cache['data'] is not None:
                return jsonify({
                    'success': False,
                    'error': f"Failed to fetch fresh data: {str(e)}. Showing cached version.",
                    'notes': cache['data'],
                    'last_updated': cache['last_updated']
                }), 200
            return jsonify({
                'success': False,
                'error': f"Failed to fetch release notes: {str(e)}"
            }), 500
            
    return jsonify({
        'success': True,
        'notes': cache['data'],
        'last_updated': cache['last_updated']
    })

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=5001, debug=True)

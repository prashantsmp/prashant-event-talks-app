document.addEventListener('DOMContentLoaded', () => {
    // State management
    let notes = [];
    let filteredNotes = [];
    let selectedNote = null;
    let currentFilter = 'all';
    let searchQuery = '';
    let showHashtags = true;
    
    // Elements
    const notesContainer = document.getElementById('notes-container');
    const loadingState = document.getElementById('loading-state');
    const errorState = document.getElementById('error-state');
    const errorMessage = document.getElementById('error-message');
    const emptyState = document.getElementById('empty-state');
    
    const refreshBtn = document.getElementById('refresh-btn');
    const refreshIcon = document.getElementById('refresh-icon');
    const lastUpdatedText = document.getElementById('last-updated-text');
    const retryBtn = document.getElementById('retry-btn');
    
    // Stats elements
    const statTotal = document.getElementById('stat-total');
    const statFeatures = document.getElementById('stat-features');
    const statAnnouncements = document.getElementById('stat-announcements');
    const statIssues = document.getElementById('stat-issues');
    
    // Filter controls
    const searchInput = document.getElementById('search-input');
    const clearSearchBtn = document.getElementById('clear-search');
    const filterChips = document.querySelectorAll('.chip');
    const resetFiltersBtn = document.getElementById('reset-filters-btn');
    
    // Composer elements
    const composerEmptyState = document.getElementById('composer-empty-state');
    const composerWorkspace = document.getElementById('composer-workspace');
    const selectedType = document.getElementById('selected-type');
    const selectedDate = document.getElementById('selected-date');
    const selectedTitlePreview = document.getElementById('selected-title-preview');
    const selectedBodyPreview = document.getElementById('selected-body-preview');
    
    const tweetTextarea = document.getElementById('tweet-textarea');
    const charCount = document.getElementById('char-count');
    const charProgress = document.getElementById('char-progress');
    
    const btnShorten = document.getElementById('btn-shorten');
    const btnHashtag = document.getElementById('btn-hashtag');
    const btnResetTweet = document.getElementById('btn-reset-tweet');
    const tweetBtn = document.getElementById('tweet-btn');
    const originalLink = document.getElementById('original-link');

    // Progress Ring Constants
    const circleRadius = 14;
    const circumference = 2 * Math.PI * circleRadius;
    charProgress.style.strokeDasharray = `${circumference} ${circumference}`;
    charProgress.style.strokeDashoffset = circumference;

    // Initialize Lucide Icons
    lucide.createIcons();

    // ----------------------------------------------------
    // DATA FETCHING & STATE UPDATES
    // ----------------------------------------------------
    
    async function fetchNotes(force = false) {
        setLoading(true);
        try {
            const url = `/api/notes${force ? '?force=true' : ''}`;
            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            
            if (data.notes && data.notes.length > 0) {
                notes = data.notes;
                updateStats();
                applyFilters();
                updateLastUpdated(data.last_updated);
                
                if (data.error) {
                    // Non-fatal error (e.g. fetch failed but showing cached data)
                    showToast(data.error, 'warning');
                }
            } else {
                throw new Error("No release notes found in feed.");
            }
        } catch (err) {
            console.error('Error fetching release notes:', err);
            errorMessage.textContent = err.message || "Failed to load release notes.";
            setError(true);
        } finally {
            setLoading(false);
        }
    }

    function setLoading(isLoading) {
        if (isLoading) {
            loadingState.style.display = 'flex';
            notesContainer.querySelectorAll('.note-card').forEach(c => c.style.opacity = '0.5');
            refreshIcon.classList.add('spin-anim');
            refreshBtn.disabled = true;
            errorState.style.display = 'none';
            emptyState.style.display = 'none';
        } else {
            loadingState.style.display = 'none';
            refreshIcon.classList.remove('spin-anim');
            refreshBtn.disabled = false;
        }
    }

    function setError(isError) {
        if (isError) {
            errorState.style.display = 'flex';
            emptyState.style.display = 'none';
            loadingState.style.display = 'none';
            // Clear current cards
            const cards = notesContainer.querySelectorAll('.note-card');
            cards.forEach(c => c.remove());
        } else {
            errorState.style.display = 'none';
        }
    }

    function updateLastUpdated(timestamp) {
        if (!timestamp) {
            lastUpdatedText.textContent = "Never updated";
            return;
        }
        const date = new Date(timestamp * 1000);
        const formatTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        lastUpdatedText.textContent = `Updated at ${formatTime}`;
    }

    function updateStats() {
        const total = notes.length;
        const features = notes.filter(n => n.type.toLowerCase() === 'feature').length;
        const announcements = notes.filter(n => n.type.toLowerCase() === 'announcement').length;
        const issues = notes.filter(n => ['issue', 'deprecation'].includes(n.type.toLowerCase())).length;
        
        statTotal.textContent = total;
        statFeatures.textContent = features;
        statAnnouncements.textContent = announcements;
        statIssues.textContent = issues;
    }

    // ----------------------------------------------------
    // FILTER & SEARCH LOGIC
    // ----------------------------------------------------
    
    function applyFilters() {
        filteredNotes = notes.filter(note => {
            const matchesSearch = searchQuery === '' || 
                note.text.toLowerCase().includes(searchQuery) ||
                note.type.toLowerCase().includes(searchQuery) ||
                note.date.toLowerCase().includes(searchQuery);
            
            const noteType = note.type.toLowerCase();
            let matchesCategory = true;
            
            if (currentFilter !== 'all') {
                if (currentFilter === 'issue') {
                    matchesCategory = noteType === 'issue';
                } else if (currentFilter === 'deprecation') {
                    matchesCategory = noteType === 'deprecation';
                } else {
                    matchesCategory = noteType === currentFilter;
                }
            }
            
            return matchesSearch && matchesCategory;
        });

        renderNotesList();
    }

    function renderNotesList() {
        // Clear previous note cards (keeping loading/empty/error states)
        const oldCards = notesContainer.querySelectorAll('.note-card');
        oldCards.forEach(c => c.remove());

        if (filteredNotes.length === 0) {
            emptyState.style.display = 'flex';
            return;
        }
        
        emptyState.style.display = 'none';

        filteredNotes.forEach(note => {
            const card = document.createElement('div');
            card.className = 'note-card';
            if (selectedNote && selectedNote.text === note.text && selectedNote.date === note.date) {
                card.classList.add('selected');
            }

            const typeLower = note.type.toLowerCase();
            let displayType = note.type;
            let badgeClass = 'general';
            
            if (typeLower.includes('feature')) badgeClass = 'feature';
            else if (typeLower.includes('announcement')) badgeClass = 'announcement';
            else if (typeLower.includes('issue')) badgeClass = 'issue';
            else if (typeLower.includes('deprecation')) badgeClass = 'deprecation';

            card.innerHTML = `
                <div class="card-header">
                    <div class="card-meta">
                        <span class="badge ${badgeClass}">${displayType}</span>
                        <span class="card-date">
                            <i data-lucide="calendar"></i>
                            ${note.date}
                        </span>
                    </div>
                    <span class="card-action-hint">
                        Select <i data-lucide="arrow-right"></i>
                    </span>
                </div>
                <div class="card-body">
                    ${note.html}
                </div>
            `;

            // Attach selection handler
            card.addEventListener('click', () => selectNote(note, card));
            notesContainer.appendChild(card);
        });

        // Initialize Lucide icons on newly created elements
        lucide.createIcons();
    }

    // ----------------------------------------------------
    // COMPOSER & TWEET LOGIC
    // ----------------------------------------------------
    
    function selectNote(note, cardElement) {
        // Highlight active card
        notesContainer.querySelectorAll('.note-card').forEach(c => c.classList.remove('selected'));
        if (cardElement) {
            cardElement.classList.add('selected');
        }

        selectedNote = note;
        
        // Show composer layout
        composerEmptyState.style.display = 'none';
        composerWorkspace.style.display = 'flex';
        
        // Populate preview panel
        selectedType.textContent = note.type;
        selectedType.className = `badge ${note.type.toLowerCase()}`;
        selectedDate.textContent = note.date;
        selectedTitlePreview.textContent = `BigQuery ${note.type} Update`;
        selectedBodyPreview.innerHTML = note.html;
        
        if (note.link) {
            originalLink.href = note.link;
            originalLink.style.display = 'inline-flex';
        } else {
            originalLink.style.display = 'none';
        }

        // Generate standard tweet content
        generateDefaultTweet();
    }

    function generateDefaultTweet() {
        if (!selectedNote) return;

        let cleanText = selectedNote.text;
        
        // Truncate to a reasonable length for the template
        if (cleanText.length > 180) {
            cleanText = cleanText.substring(0, 177) + '...';
        }

        let typeLabel = selectedNote.type;
        // Format: "BigQuery [Feature] (June 17): You can enable autonomous embeddings... Read details: https://docs.cloud.google.com/..."
        let tweetContent = `BigQuery #${typeLabel} Update (${selectedNote.date}):\n\n"${cleanText}"`;
        
        if (selectedNote.link) {
            tweetContent += `\n\nDocs: ${selectedNote.link}`;
        }

        if (showHashtags) {
            tweetContent += `\n\n#BigQuery #GoogleCloud #GCP`;
        }

        tweetTextarea.value = tweetContent;
        updateCharCount();
    }

    function updateCharCount() {
        const text = tweetTextarea.value;
        const remaining = 280 - text.length;
        charCount.textContent = remaining;

        // Progress ring logic
        const percent = Math.min(Math.max(text.length / 280, 0), 1);
        const offset = circumference - (percent * circumference);
        charProgress.style.strokeDashoffset = offset;

        // Progress colors
        if (remaining < 0) {
            charProgress.style.stroke = 'var(--accent-red)';
            charCount.style.color = 'var(--accent-red)';
        } else if (remaining <= 20) {
            charProgress.style.stroke = 'var(--accent-amber)';
            charCount.style.color = 'var(--accent-amber)';
        } else {
            charProgress.style.stroke = 'var(--accent-cyan)';
            charCount.style.color = 'var(--color-text-secondary)';
        }

        // Disable tweet button if empty or negative characters
        tweetBtn.disabled = text.length === 0 || remaining < 0;
    }

    // Smart truncation tool
    function shortenTweet() {
        const text = tweetTextarea.value;
        if (text.length <= 280) {
            showToast("Tweet is already within the 280 limit!", "success");
            return;
        }

        // Try to replace text quotes or description to make it fit
        let cleanText = selectedNote.text;
        
        // Target length calculation
        // Total characters in envelope: "BigQuery #[Type] Update ([Date]): \n\n\"\" \n\nDocs: [Link] \n\n#BigQuery #GoogleCloud #GCP"
        const typeLabel = selectedNote.type;
        const envelopeLength = `BigQuery #${typeLabel} Update (${selectedNote.date}):\n\n""`.length + 
            (selectedNote.link ? `\n\nDocs: ${selectedNote.link}`.length : 0) +
            (showHashtags ? `\n\n#BigQuery #GoogleCloud #GCP`.length : 0);
        
        const maxTextLen = 280 - envelopeLength - 3; // -3 for "..."
        
        if (maxTextLen > 10) {
            cleanText = cleanText.substring(0, maxTextLen) + '...';
            let tweetContent = `BigQuery #${typeLabel} Update (${selectedNote.date}):\n\n"${cleanText}"`;
            if (selectedNote.link) {
                tweetContent += `\n\nDocs: ${selectedNote.link}`;
            }
            if (showHashtags) {
                tweetContent += `\n\n#BigQuery #GoogleCloud #GCP`;
            }
            tweetTextarea.value = tweetContent;
            updateCharCount();
            showToast("Shortened tweet text to fit limit", "success");
        } else {
            // Envelope is too long, slice raw content
            tweetTextarea.value = text.substring(0, 277) + '...';
            updateCharCount();
            showToast("Truncated text directly", "warning");
        }
    }

    // Toggle Hashtags
    function toggleHashtags() {
        showHashtags = !showHashtags;
        
        // Toggle active style
        if (showHashtags) {
            btnHashtag.classList.add('active');
        } else {
            btnHashtag.classList.remove('active');
        }

        // Re-generate tweet template with new preference
        const currentVal = tweetTextarea.value;
        const tagString = `\n\n#BigQuery #GoogleCloud #GCP`;
        
        if (showHashtags) {
            if (!currentVal.includes('#BigQuery #GoogleCloud')) {
                tweetTextarea.value = currentVal + tagString;
            }
        } else {
            tweetTextarea.value = currentVal.replace(tagString, '').replace('#BigQuery #GoogleCloud #GCP', '').trim();
        }
        updateCharCount();
    }

    // Open X Web Intent
    function launchTweet() {
        const text = tweetTextarea.value;
        if (text.length > 280) {
            showToast("Tweet exceeds the 280 character limit!", "error");
            return;
        }
        const intentUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`;
        window.open(intentUrl, '_blank', 'width=550,height=420');
    }

    // ----------------------------------------------------
    // INTERACTIVE TOAST SYSTEM
    // ----------------------------------------------------
    
    function showToast(message, type = 'success') {
        const toast = document.createElement('div');
        toast.className = `toast-banner toast-${type}`;
        
        let iconName = 'check-circle';
        if (type === 'error') iconName = 'alert-octagon';
        if (type === 'warning') iconName = 'alert-triangle';
        
        toast.innerHTML = `
            <i data-lucide="${iconName}"></i>
            <span>${message}</span>
        `;
        
        document.body.appendChild(toast);
        lucide.createIcons();
        
        // Slide in
        setTimeout(() => toast.classList.add('show'), 10);
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, 3500);
    }

    // Add toast CSS variables dynamic inject
    const styleEl = document.createElement('style');
    styleEl.innerHTML = `
        .toast-banner {
            position: fixed;
            bottom: 24px;
            right: 24px;
            background: #1e293b;
            color: #f8fafc;
            padding: 0.875rem 1.25rem;
            border-radius: 8px;
            display: flex;
            align-items: center;
            gap: 0.75rem;
            box-shadow: 0 10px 25px rgba(0,0,0,0.4);
            border: 1px solid rgba(255,255,255,0.08);
            transform: translateY(100px);
            opacity: 0;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
            z-index: 9999;
            font-size: 0.875rem;
            font-weight: 500;
        }
        .toast-banner.show {
            transform: translateY(0);
            opacity: 1;
        }
        .toast-success { border-left: 4px solid var(--accent-cyan); }
        .toast-success i { color: var(--accent-cyan); }
        .toast-warning { border-left: 4px solid var(--accent-amber); }
        .toast-warning i { color: var(--accent-amber); }
        .toast-error { border-left: 4px solid var(--accent-red); }
        .toast-error i { color: var(--accent-red); }
        .tool-btn.active {
            background: rgba(0, 255, 209, 0.1);
            color: var(--accent-cyan);
            border: 1px solid rgba(0, 255, 209, 0.2);
        }
    `;
    document.head.appendChild(styleEl);

    // ----------------------------------------------------
    // EVENT LISTENERS
    // ----------------------------------------------------
    
    // Search inputs
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        applyFilters();
    });

    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFilters();
    });

    // Chips filters
    filterChips.forEach(chip => {
        chip.addEventListener('click', () => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-filter');
            applyFilters();
        });
    });

    // Refresh controls
    refreshBtn.addEventListener('click', () => fetchNotes(true));
    retryBtn.addEventListener('click', () => fetchNotes(true));
    resetFiltersBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        filterChips.forEach(c => c.classList.remove('active'));
        document.querySelector('.chip[data-filter="all"]').classList.add('active');
        currentFilter = 'all';
        applyFilters();
    });

    // Textarea changes
    tweetTextarea.addEventListener('input', updateCharCount);

    // Tools events
    btnShorten.addEventListener('click', shortenTweet);
    btnHashtag.addEventListener('click', toggleHashtags);
    btnResetTweet.addEventListener('click', generateDefaultTweet);
    tweetBtn.addEventListener('click', launchTweet);

    // Init active hashtag button style
    btnHashtag.classList.add('active');

    // ----------------------------------------------------
    // INITIAL BOOTSTRAP
    // ----------------------------------------------------
    fetchNotes(false);
});

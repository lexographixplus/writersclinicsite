document.addEventListener('DOMContentLoaded', () => {
    // --- Firebase Service References & Functions (from window object) ---
    const authService = window.firebaseAuthService; 
    const dbService = window.firebaseFirestoreService;   
    
    const { 
        fbSignInWithEmailAndPassword, 
        fbSignOut, 
        fbOnAuthStateChanged 
    } = window;

    const { 
        fbCollection, 
        fbGetDocs, 
        fbAddDoc, 
        fbDoc, 
        fbUpdateDoc, 
        fbDeleteDoc, 
        fbQuery, 
        fbWhere, 
        fbOrderBy,
        fbServerTimestamp,
        fbGetDoc 
    } = window;

    // --- DOM Element References ---
    const adminLoginContainer = document.getElementById('adminLoginContainer');
    const adminLoginForm = document.getElementById('adminLoginForm');
    const adminEmailInput = document.getElementById('adminEmail');
    const adminPasswordInput = document.getElementById('adminPassword');

    const adminDashboardLayout = document.getElementById('adminDashboardLayout');
    const adminUserEmailDisplay = document.getElementById('adminUserEmail');
    const logoutButton = document.getElementById('logoutButton'); 

    const navLinks = document.querySelectorAll('.admin-nav a[href^="#"]');
    const adminPageTitle = document.getElementById('adminPageTitle');
    
    const sections = document.querySelectorAll('.admin-main-content .admin-section');
    const dashboardSection = document.getElementById('dashboardSection');
    const postsSection = document.getElementById('postsSection');
    const postEditorSection = document.getElementById('postEditorSection');

    const blogManagementPanel = document.getElementById('blogManagementPanel');
    const postsTableBody = blogManagementPanel ? blogManagementPanel.querySelector('tbody') : null;
    const noPostsMessage = document.getElementById('noPostsMessage');
    const filterPostStatus = document.getElementById('filterPostStatus');
    const searchPostsInput = document.getElementById('searchPostsInput');

    const postEditorForm = document.getElementById('postEditorForm');
    const postEditorTitle = document.getElementById('postEditorTitle');
    const editPostIdInput = document.getElementById('editPostId');
    const postTitleInput = document.getElementById('postTitleInput');
    const postAuthorInput = document.getElementById('postAuthorInput');
    const postSlugInput = document.getElementById('postSlugInput');
    const postStatusSelect = document.getElementById('postStatusSelect');
    const featuredImageUrlInput = document.getElementById('featuredImageUrlInput');
    const featuredImagePreview = document.getElementById('featuredImagePreview');
    
    // Get the wrapper for Quill, not the container itself initially
    const quillEditorWrapper = document.getElementById('quillEditorWrapper'); 
    
    const savePostBtn = document.getElementById('savePostBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    const navigateToCreatePostBtn = document.getElementById('navigateToCreatePostBtn');
    const bodyElement = document.body;

    // Stat elements
    const statTotalPosts = document.getElementById('statTotalPosts');
    const statPublishedPosts = document.getElementById('statPublishedPosts');
    const statDraftPosts = document.getElementById('statDraftPosts');
    const statTotalAuthors = document.getElementById('statTotalAuthors'); // Example

    // --- State Variables ---
    let currentUser = null; 
    let currentAdminEmail = ''; 
    let isAdminLoggedIn = false; 
    let currentEditingPostId = null;
    let quillInstance = null; 

    // --- Initialization ---
    function init() {
        // Check if essential Firebase services, functions, or Quill.js are available on the window object
        if (!authService || !dbService || 
            !fbSignInWithEmailAndPassword || !fbOnAuthStateChanged || !fbCollection ||
            typeof window.Quill === 'undefined') { 
            console.error("Firebase services, functions, or Quill.js core not available on window. Retrying...");
            // Retry initialization after a short delay if dependencies are not yet loaded
            setTimeout(init, 1000); 
            return;
        }
        // If all dependencies are loaded, proceed with setting up event listeners and monitoring auth state
        setupEventListeners();
        monitorAuthState(); 
    }

    // --- QuillJS Initialization ---
    function initializeQuillEditor(initialContentHTML = '') {
        // Ensure the wrapper element for Quill exists in the DOM
        if (!quillEditorWrapper) { 
            console.error("QuillJS wrapper (id='quillEditorWrapper') not found!");
            return;
        }

        // Clean up any previous Quill instance and its container
        if (quillInstance) {
            quillInstance = null; // Dereference the old Quill instance to allow garbage collection
        }
        // Clear the wrapper's content, effectively removing the previous #quillEditorContainer if it existed
        quillEditorWrapper.innerHTML = ''; 

        // Create a new container div for Quill to attach to.
        // This div will receive the ID that CSS targets for styling the editor area.
        let dynamicQuillContainer = document.createElement('div');
        dynamicQuillContainer.id = 'quillEditorContainer'; // The ID your CSS expects for the editor itself
        quillEditorWrapper.appendChild(dynamicQuillContainer); // Add the new container to the wrapper

        try {
            // Initialize Quill on the new, dynamically created div
            quillInstance = new Quill(dynamicQuillContainer, { 
                modules: {
                    toolbar: [ // Define the toolbar options
                        [{ 'header': [1, 2, 3, 4, false] }],
                        ['bold', 'italic', 'underline', 'strike'],        
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'script': 'sub'}, { 'script': 'super' }],      
                        [{ 'indent': '-1'}, { 'indent': '+1' }],          
                        [{ 'direction': 'rtl' }],                         
                        [{ 'color': [] }, { 'background': [] }],          
                        [{ 'font': [] }],
                        [{ 'align': [] }],
                        ['link', 'image', 'video'], // Options for embedding links, images, and videos
                        ['clean'] // Button to remove formatting
                    ]
                },
                placeholder: 'Compose your amazing story...', // Placeholder text for the editor
                theme: 'snow' // Use the 'snow' theme for Quill
            });

            // If initial HTML content is provided, paste it into the editor
            if (initialContentHTML) {
                quillInstance.clipboard.dangerouslyPasteHTML(0, initialContentHTML);
            } else {
                // Ensure the editor is empty (with a newline) if no initial content is provided
                quillInstance.setContents([{ insert: '\n' }]);
            }
            // console.log('QuillJS is ready to work on new container!');

        } catch (e) {
            console.error("Error initializing QuillJS instance:", e);
            // If initialization fails, display an error message in the container
            if (dynamicQuillContainer) { 
                dynamicQuillContainer.textContent = "Failed to load QuillJS. Check console for errors.";
            }
        }
    }


    // --- Firebase Authentication ---
    function monitorAuthState() {
        // Ensure Firebase auth functions are available
        if (!fbOnAuthStateChanged || !authService) {
            console.error("fbOnAuthStateChanged or authService is not available.");
            return;
        }
        // Listen for changes in authentication state
        fbOnAuthStateChanged(authService, user => { 
            if (user) { // If user is logged in
                currentUser = user;
                currentAdminEmail = user.email;
                isAdminLoggedIn = true; 
            } else { // If user is logged out
                currentUser = null;
                currentAdminEmail = '';
                isAdminLoggedIn = false;
                // Clean up Quill editor if the user logs out
                if (quillEditorWrapper) { 
                    quillEditorWrapper.innerHTML = ''; 
                }
                quillInstance = null; 
            }
            // Update UI based on login state
            updateLoginStateUI();
            // Update the active view (e.g., redirect to dashboard if logged in, or login page if not)
            updateActiveView(window.location.hash || (currentUser ? '#dashboard' : ''));
            if (currentUser) {
                loadPostsFromFirestore(); // Load posts if user is logged in
                loadDashboardStats(); // Load dashboard stats
            } else {
                // Clear posts table and stats if user is logged out
                if(postsTableBody) postsTableBody.innerHTML = ''; 
                if(noPostsMessage && !noPostsMessage.classList.contains('hidden') ) noPostsMessage.classList.remove('hidden'); 
                updateDashboardStatsUI(0,0,0,0); 
            }
        });
    }

    async function handleLogin(event) {
        event.preventDefault(); // Prevent default form submission
        const email = adminEmailInput.value;
        const password = adminPasswordInput.value;

        // Ensure Firebase login function is available
        if (!fbSignInWithEmailAndPassword || !authService) {
            console.error("fbSignInWithEmailAndPassword or authService is not available.");
            alert("Login service is not ready. Please try again shortly.");
            return;
        }

        try {
            // Attempt to sign in with email and password
            await fbSignInWithEmailAndPassword(authService, email, password); 
            // Auth state change will be handled by monitorAuthState
        } catch (error) {
            console.error("Login Error:", error);
            alert(`Login failed: ${error.message}`);
        }
    }

    async function handleLogout() {
        // Ensure Firebase logout function is available
        if (!fbSignOut || !authService) {
            console.error("fbSignOut or authService is not available.");
            alert("Logout service is not ready.");
            return;
        }
        try {
            // Attempt to sign out
            await fbSignOut(authService); 
            window.location.hash = ''; // Clear hash to go to login view
            // Auth state change will be handled by monitorAuthState
        } catch (error) {
            console.error("Logout Error:", error);
            alert(`Logout failed: ${error.message}`);
        }
    }

    function updateLoginStateUI() {
        // Toggle visibility of login container and dashboard layout based on user login status
        if (currentUser) {
            adminLoginContainer.classList.add('hidden');
            adminDashboardLayout.classList.remove('hidden');
            if(adminUserEmailDisplay) adminUserEmailDisplay.textContent = currentAdminEmail;
            bodyElement.classList.remove('login-active'); // Class for body styling when login is active
        } else {
            adminLoginContainer.classList.remove('hidden');
            adminDashboardLayout.classList.add('hidden');
            if(adminUserEmailDisplay) adminUserEmailDisplay.textContent = '';
            bodyElement.classList.add('login-active');
        }
        feather.replace(); // Re-initialize Feather icons if any new ones are displayed
    }

    // --- Navigation & View Management ---
    function updateActiveView(hash) {
        // If user is not logged in and tries to access a protected hash, redirect to login
        if (!currentUser && hash !== '') { 
            window.location.hash = '';
            hash = ''; 
        } else if (currentUser && (hash === '' || hash === '#')) { 
            // If user is logged in and hash is empty, default to dashboard
            hash = '#dashboard';
        }
        
        // Update active state for navigation links
        navLinks.forEach(link => link.classList.remove('active'));
        // Hide all admin sections
        sections.forEach(section => section.classList.add('hidden'));

        let targetSectionId = hash ? hash.substring(1) + 'Section' : null;
        let pageTitleText = 'Admin Panel'; 

        // Handle specific routes for creating or editing posts
        if (hash === '#create-post') {
            targetSectionId = 'postEditorSection';
            pageTitleText = 'Create New Post';
            setupFormForCreate(); // Prepare the editor form for creating a new post
        } else if (hash && hash.startsWith('#edit-post-')) {
            targetSectionId = 'postEditorSection';
            pageTitleText = 'Edit Post';
            const postId = hash.split('-').pop(); // Extract post ID from hash
            setupFormForEdit(postId); // Prepare the editor form for editing an existing post
        }

        // Highlight the current navigation link
        const currentNavLink = document.querySelector(`.admin-nav a[href="${(hash && hash.startsWith('#edit-post-')) ? '#create-post' : hash}"]`);
        // Get the target section element
        const currentSection = targetSectionId ? document.getElementById(targetSectionId) : null;

        if (currentNavLink && !currentNavLink.closest('.logout-link')) {
            currentNavLink.classList.add('active');
            // Set page title based on the active link, unless it's create/edit post
            if (hash !== '#create-post' && !(hash && hash.startsWith('#edit-post-'))) {
                 pageTitleText = currentNavLink.textContent.trim();
            }
        }
        
        // Show the target section
        if (currentSection) {
            currentSection.classList.remove('hidden');
        } else if (currentUser) { 
            // Default to dashboard section if no specific section matches and user is logged in
            dashboardSection.classList.remove('hidden');
            const dashNav = document.getElementById('navDashboard');
            if(dashNav) dashNav.classList.add('active');
            pageTitleText = 'Dashboard';
        } 
        
        // Update the main page title
        adminPageTitle.textContent = pageTitleText;
        feather.replace(); // Re-initialize Feather icons
    }


    // --- Firestore Blog Post Management ---
    async function loadPostsFromFirestore(filterParams = {}) {
        // Ensure user is logged in and Firestore services are available
        if (!currentUser || !postsTableBody || !fbCollection || !fbOrderBy || !fbGetDocs || !fbQuery || !dbService) { 
            if(!currentUser) console.log("Cannot load posts, user not logged in.");
            else console.error("Cannot load posts, Firestore services or functions not available.");
            return;
        }

        try {
            // Base query constraints: order by creation date descending
            let postsQueryConstraints = [fbOrderBy("createdAt", "desc")];

            // Add status filter if provided
            if (filterParams.status && filterParams.status !== 'all') {
                postsQueryConstraints.push(fbWhere("status", "==", filterParams.status));
            }
            
            // Construct the Firestore query
            const postsQueryInstance = fbQuery(fbCollection(dbService, "posts"), ...postsQueryConstraints); 
            const querySnapshot = await fbGetDocs(postsQueryInstance); 

            let fetchedPosts = [];
            querySnapshot.forEach((doc) => {
                fetchedPosts.push({ id: doc.id, ...doc.data() });
            });

            // Apply search term filter if provided (client-side filtering after fetching)
            if (filterParams.searchTerm) {
                const searchTerm = filterParams.searchTerm.toLowerCase();
                fetchedPosts = fetchedPosts.filter(post => post.title && post.title.toLowerCase().includes(searchTerm));
            }
            
            // Render the fetched posts in the table
            renderBlogTable(fetchedPosts);
            
        } catch (error) {
            console.error("Error loading posts: ", error);
            if(postsTableBody) postsTableBody.innerHTML = '<tr><td colspan="5">Error loading posts. Check console.</td></tr>';
            if(noPostsMessage && !noPostsMessage.classList.contains('hidden')) noPostsMessage.classList.add('hidden'); 
        }
    }
    
    async function loadDashboardStats() {
        if (!currentUser || !dbService || !fbCollection || !fbGetDocs) {
            updateDashboardStatsUI(0,0,0,0); // Reset stats if services unavailable
            return;
        }
        try {
            const allPostsCollectionRef = fbCollection(dbService, "posts");
            const allPostsSnapshot = await fbGetDocs(allPostsCollectionRef);
            let allPostsForStats = [];
            allPostsSnapshot.forEach((doc) => allPostsForStats.push(doc.data()));
            
            const total = allPostsForStats.length;
            const published = allPostsForStats.filter(p => p.status === 'published').length;
            const drafts = allPostsForStats.filter(p => p.status === 'draft').length;
            // For authors, this is a placeholder. You'd typically query an authors collection or aggregate from posts.
            const authors = new Set(allPostsForStats.map(p => p.author)).size; 
            
            updateDashboardStatsUI(total, published, drafts, authors > 0 ? authors : (total > 0 ? 1 : 0) );
        } catch (error) {
            console.error("Error loading dashboard stats:", error);
            updateDashboardStatsUI(0,0,0,0);
        }
    }

    function updateDashboardStatsUI(total, published, drafts, authors) {
        // Update the text content of dashboard stat elements
        if (statTotalPosts) statTotalPosts.textContent = total;
        if (statPublishedPosts) statPublishedPosts.textContent = published;
        if (statDraftPosts) statDraftPosts.textContent = drafts;
        if (statTotalAuthors) statTotalAuthors.textContent = authors; // Example
    }

    function renderBlogTable(postsToRender) {
        if (!postsTableBody) return; // Ensure table body exists
        postsTableBody.innerHTML = ''; // Clear existing table rows

        if (postsToRender.length === 0) {
            // Show 'no posts' message if the array is empty
            if(noPostsMessage) noPostsMessage.classList.remove('hidden');
        } else {
            // Hide 'no posts' message
            if(noPostsMessage) noPostsMessage.classList.add('hidden');
            // Create and append a table row for each post
            postsToRender.forEach(post => {
                const row = document.createElement('tr');
                // Format date, handling potential null or different date formats
                let displayDate = 'N/A';
                if (post.createdAt && post.createdAt.toDate) { 
                    displayDate = post.createdAt.toDate().toLocaleDateString();
                } else if (post.date) { // Fallback for older date format if any
                     displayDate = new Date(post.date).toLocaleDateString();
                }

                // Populate row with post data
                row.innerHTML = `
                    <td>${post.title || 'No Title'}</td>
                    <td>${post.author || 'N/A'}</td>
                    <td>${displayDate}</td>
                    <td><span class="status-badge status-${post.status || 'unknown'}">${(post.status || 'unknown').charAt(0).toUpperCase() + (post.status || 'unknown').slice(1)}</span></td>
                    <td class="actions">
                        <button class="btn btn-secondary btn-sm btn-edit" data-id="${post.id}" title="Edit"><i data-feather="edit-2"></i> Edit</button>
                        <button class="btn btn-danger btn-sm btn-delete" data-id="${post.id}" title="Delete"><i data-feather="trash-2"></i> Delete</button>
                    </td>
                `;
                postsTableBody.appendChild(row);
            });
            feather.replace(); // Re-initialize Feather icons for new buttons
            addTableActionListeners(); // Add event listeners to new action buttons
        }
    }

    function addTableActionListeners() {
        if (!postsTableBody) return;
        // Add click listeners for edit buttons
        postsTableBody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.currentTarget.dataset.id;
                window.location.hash = `#edit-post-${postId}`; // Navigate to edit post view
            });
        });
        // Add click listeners for delete buttons
        postsTableBody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.currentTarget.dataset.id;
                handleDeletePost(postId); // Handle post deletion
            });
        });
    }

    function handleFilterAndSearch() {
        if (!currentUser) return; // Only allow if user is logged in
        // Get filter values
        const statusFilter = filterPostStatus ? filterPostStatus.value : 'all';
        const searchTerm = searchPostsInput ? searchPostsInput.value : '';
        // Reload posts with new filter parameters
        loadPostsFromFirestore({ status: statusFilter, searchTerm: searchTerm });
    }

    async function handleDeletePost(postId) {
        // Ensure user is logged in and Firestore delete functions are available
        if (!currentUser || !fbDeleteDoc || !fbDoc || !dbService) {
            alert("You must be logged in to delete posts or delete service is not ready.");
            return;
        }
        // Confirm deletion with the user
        if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            try {
                // Delete the post document from Firestore
                await fbDeleteDoc(fbDoc(dbService, "posts", postId)); 
                alert(`Post deleted successfully.`); 
                loadPostsFromFirestore(); // Reload posts to reflect deletion
                loadDashboardStats(); // Reload dashboard stats
                // If the currently edited post was deleted, navigate away from editor
                if (currentEditingPostId === postId && window.location.hash.startsWith('#edit-post-')) {
                    window.location.hash = '#posts';
                }
            } catch (error) {
                console.error("Error deleting post: ", error);
                alert(`Failed to delete post: ${error.message}`);
            }
        }
    }


    // --- Post Editor Form Handling ---
    function setupFormForCreate() {
        // Reset form for creating a new post
        if(postEditorTitle) postEditorTitle.textContent = 'Create New Post';
        if(postEditorForm) postEditorForm.reset(); 
        if(editPostIdInput) editPostIdInput.value = ''; // Clear hidden post ID input
        currentEditingPostId = null; // No post is being edited
        // Reset featured image preview
        if(featuredImagePreview) {
            featuredImagePreview.style.display = 'none';
            featuredImagePreview.src = '#';
        }
        if(featuredImageUrlInput) featuredImageUrlInput.value = ''; 
        
        initializeQuillEditor(''); // Initialize Quill editor with empty content
        
        if(cancelEditBtn) cancelEditBtn.classList.add('hidden'); // Hide cancel button for new post
        if(savePostBtn) savePostBtn.innerHTML = '<i data-feather="save"></i>Save Post'; // Set save button text
        feather.replace();
    }

    async function setupFormForEdit(postId) {
        // Ensure user is logged in and Firestore document functions are available
        if (!currentUser || !fbDoc || !fbGetDoc || !dbService) {
             window.location.hash = ''; // Redirect if services not ready
             console.error("Cannot edit post, user not logged in or Firestore services not ready.");
             return;
        }
        currentEditingPostId = postId; // Set the ID of the post being edited
        if(postEditorTitle) postEditorTitle.textContent = 'Edit Post';

        try {
            // Fetch the post document from Firestore
            const postRef = fbDoc(dbService, "posts", postId); 
            const postSnap = await fbGetDoc(postRef); 

            if (postSnap.exists()) {
                const post = postSnap.data();
                // Populate form fields with post data
                if(editPostIdInput) editPostIdInput.value = postId; 
                if(postTitleInput) postTitleInput.value = post.title || '';
                if(postAuthorInput) postAuthorInput.value = post.author || '';
                if(postSlugInput) postSlugInput.value = post.slug || '';
                if(postStatusSelect) postStatusSelect.value = post.status || 'draft';

                // Handle featured image URL and preview
                if (post.featuredImageUrl) {
                    if(featuredImageUrlInput) featuredImageUrlInput.value = post.featuredImageUrl;
                    if(featuredImagePreview) {
                        featuredImagePreview.src = post.featuredImageUrl;
                        featuredImagePreview.style.display = 'block';
                    }
                } else {
                    if(featuredImageUrlInput) featuredImageUrlInput.value = '';
                    if(featuredImagePreview) {
                        featuredImagePreview.style.display = 'none';
                        featuredImagePreview.src = '#';
                    }
                }
                
                // Initialize Quill editor with existing post content
                initializeQuillEditor(post.contentHTML || ''); 
                
                if(cancelEditBtn) cancelEditBtn.classList.remove('hidden'); // Show cancel button for editing
                if(savePostBtn) savePostBtn.innerHTML = '<i data-feather="save"></i>Update Post'; // Set save button text for update
                feather.replace();

            } else {
                console.log("No such document to edit!");
                alert('Post not found for editing.');
                window.location.hash = '#posts'; // Redirect if post not found
            }
        } catch (error) {
            console.error("Error fetching post for edit: ", error);
            alert('Failed to load post for editing.');
            window.location.hash = '#posts'; // Redirect on error
        }
    }
    
    async function handleSavePost(event) {
        event.preventDefault(); // Prevent default form submission
        // Ensure user is logged in and necessary services/editor instance are available
        if (!currentUser || !fbServerTimestamp || !dbService || !quillInstance) {
            alert("You must be logged in to save posts, or editor/save service is not ready.");
            return;
        }

        // Get form field values
        const id = editPostIdInput.value;
        const title = postTitleInput.value;
        const author = postAuthorInput.value;
        let slug = postSlugInput.value.trim();
        // Auto-generate slug from title if slug is empty
        if (!slug && title) slug = slugify(title); 
        const status = postStatusSelect.value;
        const featuredImgUrl = featuredImageUrlInput.value.trim(); 

        // Validate required fields
        if (!title || !author) {
            alert('Title and Author are required.');
            return;
        }
        
        try {
            // Get HTML content from Quill editor
            const contentHTML = quillInstance.root.innerHTML;
            // Validate content is not empty (Quill adds <p><br></p> for empty content)
            if (!contentHTML || contentHTML === '<p><br></p>') { 
                alert("Post content cannot be empty.");
                return;
            }

            // Prepare post data object
            const postData = {
                title,
                author,
                slug,
                status,
                featuredImageUrl: featuredImgUrl, 
                contentHTML: contentHTML, 
                updatedAt: fbServerTimestamp(), // Set server timestamp for update time
            };

            if (id) { // If ID exists, update existing post
                if (!fbDoc || !fbUpdateDoc) { alert("Update service not ready."); return; }
                const postRef = fbDoc(dbService, "posts", id); 
                await fbUpdateDoc(postRef, postData); 
                alert(`Post "${title}" updated successfully.`);
            } else { // If no ID, create new post
                if (!fbAddDoc || !fbCollection) { alert("Create service not ready."); return; }
                postData.createdAt = fbServerTimestamp(); // Set server timestamp for creation time
                await fbAddDoc(fbCollection(dbService, "posts"), postData); 
                alert(`Post "${title}" created successfully.`);
            }
            loadPostsFromFirestore(); // Reload posts to reflect changes
            loadDashboardStats(); // Reload dashboard stats
            window.location.hash = '#posts'; // Navigate back to posts list
        } catch (error) {
            console.error("Error saving post (or getting Quill data): ", error);
            alert(`Failed to save post: ${error.message}`);
        }
    }

    function handleFeaturedImagePreviewFromUrl() {
        // Update image preview when URL input changes
        if (!featuredImageUrlInput || !featuredImagePreview) return;
        const url = featuredImageUrlInput.value.trim();
        if (url && (url.startsWith('http://') || url.startsWith('https://'))) {
            featuredImagePreview.src = url;
            featuredImagePreview.style.display = 'block';
        } else {
            featuredImagePreview.style.display = 'none';
            featuredImagePreview.src = '#';
        }
    }

    function slugify(text) {
        // Helper function to generate a URL-friendly slug from text
        if (!text) return '';
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')           // Replace spaces with -
            .replace(/[^\w-]+/g, '')       // Remove all non-word chars
            .replace(/--+/g, '-')         // Replace multiple - with single -
            .replace(/^-+/, '')             // Trim - from start of text
            .replace(/-+$/, '');            // Trim - from end of text
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        // Login form submission
        if (adminLoginForm) {
            adminLoginForm.addEventListener('submit', handleLogin);
        }
        // Logout button click
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault(); 
                handleLogout();
            });
        }

        // Listen for hash changes to update active view
        window.addEventListener('hashchange', () => {
            updateActiveView(window.location.hash);
        });
        
        // "Add New Post" button on posts list page
        if (navigateToCreatePostBtn) {
            navigateToCreatePostBtn.addEventListener('click', () => {
                window.location.hash = '#create-post';
            });
        }
        // Cancel button in post editor
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                // Clean up Quill editor on cancel
                if (quillEditorWrapper) { 
                    quillEditorWrapper.innerHTML = ''; 
                }
                quillInstance = null; 
                window.location.hash = '#posts'; // Navigate back to posts list
            });
        }

        // Post editor form submission
        if (postEditorForm) {
            postEditorForm.addEventListener('submit', handleSavePost);
        }
        // Featured image URL input change (for preview)
        if (featuredImageUrlInput) {
            featuredImageUrlInput.addEventListener('input', handleFeaturedImagePreviewFromUrl); 
            featuredImageUrlInput.addEventListener('change', handleFeaturedImagePreviewFromUrl); 
        }

        // Filter controls for posts list
        if (filterPostStatus) {
            filterPostStatus.addEventListener('change', handleFilterAndSearch);
        }
        if (searchPostsInput) {
            // Using 'input' for real-time search as user types
            searchPostsInput.addEventListener('input', () => {
                // Debounce search to avoid too many Firestore reads if desired, or filter client-side
                handleFilterAndSearch(); 
            });
        }
        
        // Auto-slug generation from title (if slug field is empty)
        if (postTitleInput && postSlugInput) {
            postTitleInput.addEventListener('keyup', () => {
                // Only auto-slugify if creating new post or slug is currently empty
                if (!editPostIdInput.value || !postSlugInput.value.trim()) { 
                    postSlugInput.value = slugify(postTitleInput.value);
                }
            });
             postTitleInput.addEventListener('blur', () => { 
                if (!editPostIdInput.value || !postSlugInput.value.trim()) {
                    postSlugInput.value = slugify(postTitleInput.value);
                }
            });
        }
    }

    // --- Start the app ---
    init();
});

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
    const quillEditorContainer = document.getElementById('quillEditorContainer'); 
    const savePostBtn = document.getElementById('savePostBtn');
    const cancelEditBtn = document.getElementById('cancelEditBtn');

    const navigateToCreatePostBtn = document.getElementById('navigateToCreatePostBtn');
    const bodyElement = document.body;

    // Stat elements
    const statTotalPosts = document.getElementById('statTotalPosts');
    const statPublishedPosts = document.getElementById('statPublishedPosts');
    const statDraftPosts = document.getElementById('statDraftPosts');

    // --- State Variables ---
    let currentUser = null; 
    let currentAdminEmail = ''; 
    let isAdminLoggedIn = false; 
    let currentEditingPostId = null;
    let quillInstance = null; 

    // --- Initialization ---
    function init() {
        if (!authService || !dbService || 
            !fbSignInWithEmailAndPassword || !fbOnAuthStateChanged || !fbCollection ||
            typeof window.Quill === 'undefined') { 
            console.error("Firebase services, functions, or Quill.js core not available on window. Retrying...");
            setTimeout(init, 1000); 
            return;
        }
        setupEventListeners();
        monitorAuthState(); 
    }

    // --- QuillJS Initialization ---
    function initializeQuillEditor(initialContentHTML = '') {
        if (!quillEditorContainer) {
            console.error("QuillJS container (id='quillEditorContainer') not found!");
            return;
        }

        // Ensure the container is completely empty before initializing a new Quill instance.
        // This is crucial to prevent duplication or attaching to old DOM.
        quillEditorContainer.innerHTML = ''; 
        quillInstance = null; // Dereference any old instance explicitly

        try {
            quillInstance = new Quill(quillEditorContainer, { // Pass the DOM element directly
                modules: {
                    toolbar: [
                        [{ 'header': [1, 2, 3, 4, false] }],
                        ['bold', 'italic', 'underline', 'strike'],        
                        [{ 'list': 'ordered'}, { 'list': 'bullet' }],
                        [{ 'script': 'sub'}, { 'script': 'super' }],      
                        [{ 'indent': '-1'}, { 'indent': '+1' }],          
                        [{ 'direction': 'rtl' }],                         
                        [{ 'color': [] }, { 'background': [] }],          
                        [{ 'font': [] }],
                        [{ 'align': [] }],
                        ['link', 'image', 'video'], 
                        ['clean']                                         
                    ]
                },
                placeholder: 'Compose your amazing story...',
                theme: 'snow' 
            });

            if (initialContentHTML) {
                // Use setContents with a Delta or dangerouslyPasteHTML for raw HTML
                // For raw HTML, dangerouslyPasteHTML is more direct.
                // Ensure the HTML is clean if it's coming from an untrusted source.
                // Since it's from our DB, it should be fine.
                quillInstance.clipboard.dangerouslyPasteHTML(0, initialContentHTML);
            } else {
                // Ensure editor is empty if no initial content
                quillInstance.setContents([{ insert: '\n' }]);
            }
            console.log('QuillJS is ready to work!');

        } catch (e) {
            console.error("Error initializing QuillJS instance:", e);
            if (quillEditorContainer) { 
                quillEditorContainer.textContent = "Failed to load QuillJS. Check console for errors.";
            }
        }
    }


    // --- Firebase Authentication ---
    function monitorAuthState() {
        if (!fbOnAuthStateChanged || !authService) {
            console.error("fbOnAuthStateChanged or authService is not available.");
            return;
        }
        fbOnAuthStateChanged(authService, user => { 
            if (user) {
                currentUser = user;
                currentAdminEmail = user.email;
                isAdminLoggedIn = true; 
            } else {
                currentUser = null;
                currentAdminEmail = '';
                isAdminLoggedIn = false;
                if (quillInstance) {
                    quillEditorContainer.innerHTML = ''; // Clear DOM
                    quillInstance = null; // Dereference
                }
            }
            updateLoginStateUI();
            updateActiveView(window.location.hash || (currentUser ? '#dashboard' : ''));
            if (currentUser) {
                loadPostsFromFirestore(); 
            } else {
                if(postsTableBody) postsTableBody.innerHTML = ''; 
                if(noPostsMessage && !noPostsMessage.classList.contains('hidden') ) noPostsMessage.classList.remove('hidden'); 
                updateDashboardStats(0,0,0); 
            }
        });
    }

    async function handleLogin(event) {
        event.preventDefault();
        const email = adminEmailInput.value;
        const password = adminPasswordInput.value;

        if (!fbSignInWithEmailAndPassword || !authService) {
            console.error("fbSignInWithEmailAndPassword or authService is not available.");
            alert("Login service is not ready. Please try again shortly.");
            return;
        }

        try {
            await fbSignInWithEmailAndPassword(authService, email, password); 
        } catch (error) {
            console.error("Login Error:", error);
            alert(`Login failed: ${error.message}`);
        }
    }

    async function handleLogout() {
        if (!fbSignOut || !authService) {
            console.error("fbSignOut or authService is not available.");
            alert("Logout service is not ready.");
            return;
        }
        try {
            await fbSignOut(authService); 
            window.location.hash = ''; 
        } catch (error) {
            console.error("Logout Error:", error);
            alert(`Logout failed: ${error.message}`);
        }
    }

    function updateLoginStateUI() {
        if (currentUser) {
            adminLoginContainer.classList.add('hidden');
            adminDashboardLayout.classList.remove('hidden');
            if(adminUserEmailDisplay) adminUserEmailDisplay.textContent = currentAdminEmail;
            bodyElement.classList.remove('login-active');
        } else {
            adminLoginContainer.classList.remove('hidden');
            adminDashboardLayout.classList.add('hidden');
            if(adminUserEmailDisplay) adminUserEmailDisplay.textContent = '';
            bodyElement.classList.add('login-active');
        }
        feather.replace(); 
    }

    // --- Navigation & View Management ---
    function updateActiveView(hash) {
        if (!currentUser && hash !== '') { 
            window.location.hash = '';
            hash = ''; 
        } else if (currentUser && (hash === '' || hash === '#')) { 
            hash = '#dashboard';
        }
        
        navLinks.forEach(link => link.classList.remove('active'));
        sections.forEach(section => section.classList.add('hidden'));

        let targetSectionId = hash ? hash.substring(1) + 'Section' : null;
        let pageTitleText = 'Admin'; 

        if (hash === '#create-post') {
            targetSectionId = 'postEditorSection';
            pageTitleText = 'Create New Post';
            setupFormForCreate(); 
        } else if (hash && hash.startsWith('#edit-post-')) {
            targetSectionId = 'postEditorSection';
            pageTitleText = 'Edit Post';
            const postId = hash.split('-').pop();
            setupFormForEdit(postId); 
        }

        const currentNavLink = document.querySelector(`.admin-nav a[href="${(hash && hash.startsWith('#edit-post-')) ? '#create-post' : hash}"]`);
        const currentSection = targetSectionId ? document.getElementById(targetSectionId) : null;

        if (currentNavLink && !currentNavLink.closest('.logout-link')) {
            currentNavLink.classList.add('active');
            if (hash !== '#create-post' && !(hash && hash.startsWith('#edit-post-'))) {
                 pageTitleText = currentNavLink.textContent.trim();
            }
        }
        
        if (currentSection) {
            currentSection.classList.remove('hidden');
        } else if (currentUser) { 
            dashboardSection.classList.remove('hidden');
            const dashNav = document.getElementById('navDashboard');
            if(dashNav) dashNav.classList.add('active');
            pageTitleText = 'Dashboard';
        } 
        
        adminPageTitle.textContent = pageTitleText;
        feather.replace();
    }


    // --- Firestore Blog Post Management ---
    async function loadPostsFromFirestore(filterParams = {}) {
        if (!currentUser || !postsTableBody || !fbCollection || !fbOrderBy || !fbGetDocs || !fbQuery || !dbService) { 
            updateDashboardStats(0,0,0);
            if(!currentUser) console.log("Cannot load posts, user not logged in.");
            else console.error("Cannot load posts, Firestore services or functions not available.");
            return;
        }

        try {
            let postsQueryConstraints = [fbOrderBy("createdAt", "desc")];

            if (filterParams.status && filterParams.status !== 'all') {
                postsQueryConstraints.push(fbWhere("status", "==", filterParams.status));
            }
            
            const postsQueryInstance = fbQuery(fbCollection(dbService, "posts"), ...postsQueryConstraints); 
            const querySnapshot = await fbGetDocs(postsQueryInstance); 

            let fetchedPosts = [];
            querySnapshot.forEach((doc) => {
                fetchedPosts.push({ id: doc.id, ...doc.data() });
            });

            if (filterParams.searchTerm) {
                const searchTerm = filterParams.searchTerm.toLowerCase();
                fetchedPosts = fetchedPosts.filter(post => post.title && post.title.toLowerCase().includes(searchTerm));
            }
            
            renderBlogTable(fetchedPosts);
            
            const allPostsCollectionRef = fbCollection(dbService, "posts");
            const allPostsSnapshot = await fbGetDocs(allPostsCollectionRef); 
            let allPostsForStats = [];
            allPostsSnapshot.forEach((doc) => allPostsForStats.push(doc.data())); 
            updateDashboardStatsWithData(allPostsForStats);

        } catch (error) {
            console.error("Error loading posts: ", error);
            if(postsTableBody) postsTableBody.innerHTML = '<tr><td colspan="5">Error loading posts. Check console.</td></tr>';
            if(noPostsMessage && !noPostsMessage.classList.contains('hidden')) noPostsMessage.classList.add('hidden'); 
            updateDashboardStats(0,0,0);
        }
    }
    
    function updateDashboardStatsWithData(allPostsForStats) {
        const total = allPostsForStats.length;
        const published = allPostsForStats.filter(p => p.status === 'published').length;
        const drafts = allPostsForStats.filter(p => p.status === 'draft').length;
        updateDashboardStats(total, published, drafts);
    }

    function updateDashboardStats(total, published, drafts) {
        if (statTotalPosts) statTotalPosts.textContent = total;
        if (statPublishedPosts) statPublishedPosts.textContent = published;
        if (statDraftPosts) statDraftPosts.textContent = drafts;
    }

    function renderBlogTable(postsToRender) {
        if (!postsTableBody) return;
        postsTableBody.innerHTML = ''; 

        if (postsToRender.length === 0) {
            if(noPostsMessage) noPostsMessage.classList.remove('hidden');
        } else {
            if(noPostsMessage) noPostsMessage.classList.add('hidden');
            postsToRender.forEach(post => {
                const row = document.createElement('tr');
                let displayDate = 'N/A';
                if (post.createdAt && post.createdAt.toDate) { 
                    displayDate = post.createdAt.toDate().toLocaleDateString();
                } else if (post.date) { 
                     displayDate = new Date(post.date).toLocaleDateString();
                }

                row.innerHTML = `
                    <td>${post.title || 'No Title'}</td>
                    <td>${post.author || 'N/A'}</td>
                    <td>${displayDate}</td>
                    <td><span class="status-${post.status || 'unknown'}">${(post.status || 'unknown').charAt(0).toUpperCase() + (post.status || 'unknown').slice(1)}</span></td>
                    <td class="actions">
                        <button class="btn btn-secondary btn-sm btn-edit" data-id="${post.id}" title="Edit"><i data-feather="edit-2"></i></button>
                        <button class="btn btn-danger btn-sm btn-delete" data-id="${post.id}" title="Delete" style="background-color: #dc3545; border-color: #dc3545;"><i data-feather="trash-2"></i></button>
                    </td>
                `;
                postsTableBody.appendChild(row);
            });
            feather.replace(); 
            addTableActionListeners();
        }
    }

    function addTableActionListeners() {
        if (!postsTableBody) return;
        postsTableBody.querySelectorAll('.btn-edit').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.currentTarget.dataset.id;
                window.location.hash = `#edit-post-${postId}`;
            });
        });
        postsTableBody.querySelectorAll('.btn-delete').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const postId = e.currentTarget.dataset.id;
                handleDeletePost(postId);
            });
        });
    }

    function handleFilterAndSearch() {
        if (!currentUser) return; 
        const statusFilter = filterPostStatus ? filterPostStatus.value : 'all';
        const searchTerm = searchPostsInput ? searchPostsInput.value : '';
        loadPostsFromFirestore({ status: statusFilter, searchTerm: searchTerm });
    }

    async function handleDeletePost(postId) {
        if (!currentUser || !fbDeleteDoc || !fbDoc || !dbService) {
            alert("You must be logged in to delete posts or delete service is not ready.");
            return;
        }
        if (confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            try {
                await fbDeleteDoc(fbDoc(dbService, "posts", postId)); 
                alert(`Post deleted successfully.`); 
                loadPostsFromFirestore(); 
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
        if(postEditorTitle) postEditorTitle.textContent = 'Create New Post';
        if(postEditorForm) postEditorForm.reset(); 
        if(editPostIdInput) editPostIdInput.value = '';
        currentEditingPostId = null;
        if(featuredImagePreview) {
            featuredImagePreview.style.display = 'none';
            featuredImagePreview.src = '#';
        }
        if(featuredImageUrlInput) featuredImageUrlInput.value = ''; 
        
        initializeQuillEditor(''); 
        
        if(cancelEditBtn) cancelEditBtn.classList.add('hidden');
        if(savePostBtn) savePostBtn.textContent = 'Save Post';
    }

    async function setupFormForEdit(postId) {
        if (!currentUser || !fbDoc || !fbGetDoc || !dbService) {
             window.location.hash = ''; 
             console.error("Cannot edit post, user not logged in or Firestore services not ready.");
             return;
        }
        currentEditingPostId = postId;
        if(postEditorTitle) postEditorTitle.textContent = 'Edit Post';

        try {
            const postRef = fbDoc(dbService, "posts", postId); 
            const postSnap = await fbGetDoc(postRef); 

            if (postSnap.exists()) {
                const post = postSnap.data();
                if(editPostIdInput) editPostIdInput.value = postId; 
                if(postTitleInput) postTitleInput.value = post.title || '';
                if(postAuthorInput) postAuthorInput.value = post.author || '';
                if(postSlugInput) postSlugInput.value = post.slug || '';
                if(postStatusSelect) postStatusSelect.value = post.status || 'draft';

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
                
                initializeQuillEditor(post.contentHTML || ''); 
                
                if(cancelEditBtn) cancelEditBtn.classList.remove('hidden');
                if(savePostBtn) savePostBtn.textContent = 'Update Post';

            } else {
                console.log("No such document to edit!");
                alert('Post not found for editing.');
                window.location.hash = '#posts';
            }
        } catch (error) {
            console.error("Error fetching post for edit: ", error);
            alert('Failed to load post for editing.');
            window.location.hash = '#posts';
        }
    }
    
    async function handleSavePost(event) {
        event.preventDefault();
        if (!currentUser || !fbServerTimestamp || !dbService || !quillInstance) {
            alert("You must be logged in to save posts, or editor/save service is not ready.");
            return;
        }

        const id = editPostIdInput.value;
        const title = postTitleInput.value;
        const author = postAuthorInput.value;
        let slug = postSlugInput.value.trim();
        if (!slug && title) slug = slugify(title); 
        const status = postStatusSelect.value;
        const featuredImgUrl = featuredImageUrlInput.value.trim(); 

        if (!title || !author) {
            alert('Title and Author are required.');
            return;
        }
        
        try {
            const contentHTML = quillInstance.root.innerHTML;
            if (!contentHTML || contentHTML === '<p><br></p>') { 
                alert("Post content cannot be empty.");
                return;
            }

            const postData = {
                title,
                author,
                slug,
                status,
                featuredImageUrl: featuredImgUrl, 
                contentHTML: contentHTML, 
                updatedAt: fbServerTimestamp(), 
            };

            if (id) { 
                if (!fbDoc || !fbUpdateDoc) { alert("Update service not ready."); return; }
                const postRef = fbDoc(dbService, "posts", id); 
                await fbUpdateDoc(postRef, postData); 
                alert(`Post "${title}" updated successfully.`);
            } else { 
                if (!fbAddDoc || !fbCollection) { alert("Create service not ready."); return; }
                postData.createdAt = fbServerTimestamp(); 
                await fbAddDoc(fbCollection(dbService, "posts"), postData); 
                alert(`Post "${title}" created successfully.`);
            }
            loadPostsFromFirestore(); 
            window.location.hash = '#posts'; 
        } catch (error) {
            console.error("Error saving post (or getting Quill data): ", error);
            alert(`Failed to save post: ${error.message}`);
        }
    }

    function handleFeaturedImagePreviewFromUrl() {
        if (!featuredImageUrlInput || !featuredImagePreview) return;
        const url = featuredImageUrlInput.value.trim();
        if (url) {
            if (url.startsWith('http://') || url.startsWith('https://')) {
                featuredImagePreview.src = url;
                featuredImagePreview.style.display = 'block';
            } 
        } else {
            featuredImagePreview.style.display = 'none';
            featuredImagePreview.src = '#';
        }
    }

    function slugify(text) {
        if (!text) return '';
        return text.toString().toLowerCase()
            .replace(/\s+/g, '-')           
            .replace(/[^\w-]+/g, '')       
            .replace(/--+/g, '-')         
            .replace(/^-+/, '')             
            .replace(/-+$/, '');            
    }

    // --- Event Listeners Setup ---
    function setupEventListeners() {
        if (adminLoginForm) {
            adminLoginForm.addEventListener('submit', handleLogin);
        }
        if (logoutButton) {
            logoutButton.addEventListener('click', (e) => {
                e.preventDefault(); 
                handleLogout();
            });
        }

        window.addEventListener('hashchange', () => {
            updateActiveView(window.location.hash);
        });
        
        if (navigateToCreatePostBtn) {
            navigateToCreatePostBtn.addEventListener('click', () => {
                window.location.hash = '#create-post';
            });
        }
        if (cancelEditBtn) {
            cancelEditBtn.addEventListener('click', () => {
                if (quillInstance) {
                    quillEditorContainer.innerHTML = ''; // Clear DOM
                    quillInstance = null; 
                }
                window.location.hash = '#posts';
            });
        }

        if (postEditorForm) {
            postEditorForm.addEventListener('submit', handleSavePost);
        }
        if (featuredImageUrlInput) {
            featuredImageUrlInput.addEventListener('input', handleFeaturedImagePreviewFromUrl); 
            featuredImageUrlInput.addEventListener('change', handleFeaturedImagePreviewFromUrl); 
        }

        if (filterPostStatus) {
            filterPostStatus.addEventListener('change', handleFilterAndSearch);
        }
        if (searchPostsInput) {
            searchPostsInput.addEventListener('input', handleFilterAndSearch);
        }
        
        if (postTitleInput && postSlugInput) {
            postTitleInput.addEventListener('keyup', () => {
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

document.addEventListener('DOMContentLoaded', () => {
    // Initial setup functions that don't depend on Firebase immediately
    initMobileNav();
    initStickyHeader();
    initSmoothScroll();
    initScrollAnimations();
    initTestimonialSlider(); 
    initFormValidation();    

    // Function to attempt loading blog content, can be called initially and on retry
    function attemptToLoadBlogContent() {
        // Directly access Firebase services/functions from window object here
        const currentDbService = window.publicFirestoreService;
        const currentPublicFbCollection = window.publicFbCollection;
        // Add other functions if they are checked before calling loadBlogPosts/loadBlogPostDetail
        // For now, these two are the primary ones for the initial check.

        if (!currentDbService || !currentPublicFbCollection) {
            console.error("Firestore service not available for public blog. Retrying in 2s...");
            const blogGrid = document.getElementById('blogGrid');
            const blogPostFull = document.getElementById('blogPostFull');
            const errorMessage = "<p>Connecting to the blog database... If this message persists, please try refreshing.</p>";
            
            if (blogGrid && !blogGrid.querySelector('.error-message')) { // Avoid multiple error messages
                const errorP = document.createElement('p');
                errorP.className = 'error-message';
                errorP.innerHTML = errorMessage;
                blogGrid.innerHTML = ''; // Clear previous content
                blogGrid.appendChild(errorP);
            }
            if (blogPostFull && blogPostFull.style.display !== 'none' && !blogPostFull.querySelector('.error-message')) {
                const errorP = document.createElement('p');
                errorP.className = 'error-message';
                errorP.innerHTML = errorMessage;
                blogPostFull.innerHTML = ''; // Clear previous content
                blogPostFull.appendChild(errorP);
            }
            
            setTimeout(attemptToLoadBlogContent, 2000); // Retry
            return; 
        }

        // If services are available, proceed
        const urlParams = new URLSearchParams(window.location.search);
        const postId = urlParams.get('post');

        if (postId && document.getElementById('blogPostFull')) {
            loadBlogPostDetail(postId);
        } else if (document.getElementById('blogGrid')) {
            loadBlogPosts();
        }
    }


    // Page specific initializations for blog
    if (document.getElementById('blogGrid') || document.getElementById('blogPostFull')) {
        attemptToLoadBlogContent(); // Initial attempt to load content
    }

    if (document.querySelector('.newsletter-signup form')) {
        handleNewsletterSignup();
    }
    setActiveNavLink();
});

// 1. Mobile Navigation
function initMobileNav() {
    const navToggle = document.getElementById('mobileNavToggle');
    const mainNav = document.getElementById('mainNav');

    if (navToggle && mainNav) {
        navToggle.addEventListener('click', () => {
            mainNav.classList.toggle('active');
            const isExpanded = mainNav.classList.contains('active');
            navToggle.setAttribute('aria-expanded', isExpanded);
        });
    }
}

// 2. Sticky Header
function initStickyHeader() {
    const header = document.querySelector('.site-header');
    if (!header) return;
    const stickyOffset = header.offsetHeight; 
    window.addEventListener('scroll', () => {
        if (window.pageYOffset > stickyOffset) {
            header.classList.add('sticky');
        } else {
            header.classList.remove('sticky');
        }
    });
}

// 3. Smooth Scroll
function initSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            const href = this.getAttribute('href');
            if (href.length > 1 && document.querySelector(href)) {
                e.preventDefault();
                document.querySelector(href).scrollIntoView({ behavior: 'smooth' });
                const mainNav = document.getElementById('mainNav');
                if (mainNav && mainNav.classList.contains('active')) {
                    mainNav.classList.remove('active');
                    if(document.getElementById('mobileNavToggle')) {
                        document.getElementById('mobileNavToggle').setAttribute('aria-expanded', 'false');
                    }
                }
            }
        });
    });
}

// 4. Scroll Animations
function initScrollAnimations() {
    const animatedElements = document.querySelectorAll('.scroll-animate');
    if (!animatedElements.length) return;
    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('visible');
                observer.unobserve(entry.target); 
            }
        });
    }, { threshold: 0.1 });
    animatedElements.forEach(el => observer.observe(el));
}

// 5. Testimonial Slider
function initTestimonialSlider() {
    const slider = document.querySelector('.testimonial-slider');
    if (!slider) return;
    const slides = slider.querySelectorAll('.testimonial-slide');
    const prevButton = slider.querySelector('.prev-slide');
    const nextButton = slider.querySelector('.next-slide');
    let currentSlide = 0;

    function showSlide(index) {
        slides.forEach((slide, i) => {
            slide.classList.remove('active');
            if (i === index) slide.classList.add('active');
        });
    }

    if (slides.length > 0) {
        showSlide(currentSlide);
        if (prevButton) {
            prevButton.addEventListener('click', () => {
                currentSlide = (currentSlide - 1 + slides.length) % slides.length;
                showSlide(currentSlide);
            });
        }
        if (nextButton) {
            nextButton.addEventListener('click', () => {
                currentSlide = (currentSlide + 1) % slides.length;
                showSlide(currentSlide);
            });
        }
    }
}

// 6. Blog Post Loading (from Firestore)
async function loadBlogPosts() {
    // Access Firebase services/functions directly from window object
    const dbService = window.publicFirestoreService;
    const { 
        publicFbCollection, 
        publicFbGetDocs, 
        publicFbQuery, 
        publicFbWhere, 
        publicFbOrderBy 
    } = window;

    const blogGrid = document.getElementById('blogGrid');
    
    if (!blogGrid || !dbService || !publicFbCollection || !publicFbOrderBy || !publicFbQuery || !publicFbWhere || !publicFbGetDocs) {
        if (blogGrid) blogGrid.innerHTML = '<p>Error: Blog service is not fully ready. Please try refreshing.</p>';
        console.error("loadBlogPosts: Blog service not ready or essential functions missing from window.", 
                      {dbService, publicFbCollection, publicFbOrderBy, publicFbQuery, publicFbWhere, publicFbGetDocs});
        return;
    }
    blogGrid.innerHTML = '<p>Loading posts...</p>'; 

    try {
        const postsQuery = publicFbQuery(
            publicFbCollection(dbService, "posts"),
            publicFbWhere("status", "==", "published"),
            publicFbOrderBy("createdAt", "desc")
        );
        const querySnapshot = await publicFbGetDocs(postsQuery);

        if (querySnapshot.empty) {
            blogGrid.innerHTML = '<p>No blog posts found yet. Check back soon!</p>';
            return;
        }

        blogGrid.innerHTML = ''; 
        querySnapshot.forEach(doc => {
            const post = { id: doc.id, ...doc.data() };
            const postDate = post.createdAt && post.createdAt.toDate ? post.createdAt.toDate().toLocaleDateString() : 'N/A';
            
            let snippet = 'No snippet available.';
            if (post.contentHTML) {
                const tempDiv = document.createElement('div');
                tempDiv.innerHTML = post.contentHTML;
                snippet = tempDiv.textContent || tempDiv.innerText || "";
                snippet = snippet.substring(0, 150) + (snippet.length > 150 ? '...' : '');
            }

            const postCard = `
                <article class="blog-post-card scroll-animate fade-in">
                    ${post.featuredImageUrl ? `<img src="${post.featuredImageUrl}" alt="${post.title || 'Blog post image'}">` : '<div class="post-image-placeholder" style="height:200px; background:#eee; display:flex; align-items:center; justify-content:center;color:#aaa;">No Image</div>'}
                    <div class="blog-post-content">
                        <h3><a href="blog.html?post=${post.id}">${post.title || 'Untitled Post'}</a></h3>
                        <p class="blog-post-meta">By ${post.author || 'Unknown Author'} on ${postDate}</p>
                        <p>${snippet}</p>
                        <a href="blog.html?post=${post.id}" class="btn btn-secondary">Read More</a>
                    </div>
                </article>
            `;
            blogGrid.insertAdjacentHTML('beforeend', postCard);
        });
        initScrollAnimations(); 
    } catch (error) {
        console.error("Could not load blog posts from Firestore:", error);
        blogGrid.innerHTML = '<p>Error loading blog posts. Please try again later.</p>';
    }
}

// 7. Load Single Blog Post Detail (from Firestore)
async function loadBlogPostDetail(postId) {
    // Access Firebase services/functions directly from window object
    const dbService = window.publicFirestoreService;
    const { publicFbDoc, publicFbGetDoc } = window;

    const blogPostFull = document.getElementById('blogPostFull');
    const blogGridContainer = document.getElementById('blogGridContainer');

    if (!blogPostFull || !dbService || !publicFbDoc || !publicFbGetDoc) {
        if(blogPostFull) blogPostFull.innerHTML = '<p>Error: Blog detail service is not fully ready. Please try refreshing.</p>';
        console.error("loadBlogPostDetail: Blog detail service not ready or essential functions missing from window.",
                      {dbService, publicFbDoc, publicFbGetDoc});
        return;
    }

    if (!postId) { 
        if (blogGridContainer) blogGridContainer.style.display = 'block';
        if (blogPostFull) blogPostFull.style.display = 'none';
        return;
    }
    
    if (blogGridContainer) blogGridContainer.style.display = 'none';
    if (blogPostFull) {
        blogPostFull.style.display = 'block';
        blogPostFull.innerHTML = '<p>Loading post details...</p>'; 
    }

    try {
        const postRef = publicFbDoc(dbService, "posts", postId);
        const docSnap = await publicFbGetDoc(postRef);

        if (docSnap.exists()) {
            const post = { id: docSnap.id, ...docSnap.data() };

            if (post.status !== 'published') {
                blogPostFull.innerHTML = '<p>This post is not available.</p> <a href="blog.html" class="btn btn-primary mt-2">← Back to Blog</a>';
                document.title = "Post Not Available | Writers Clinic Gambia";
                return;
            }

            document.title = `${post.title || 'Blog Post'} | Writers Clinic Gambia`; 
            const postDate = post.createdAt && post.createdAt.toDate ? post.createdAt.toDate().toLocaleDateString() : 'N/A';
            
            blogPostFull.innerHTML = `
                <h1 class="scroll-animate fade-in">${post.title || 'Untitled Post'}</h1>
                <p class="post-meta scroll-animate fade-in">By ${post.author || 'Unknown Author'} on ${postDate}</p>
                ${post.featuredImageUrl ? `<img src="${post.featuredImageUrl}" alt="${post.title || 'Featured Image'}" class="featured-image scroll-animate fade-in" style="margin-bottom: var(--spacing-md); border-radius: var(--border-radius);">` : ''}
                <div class="post-content scroll-animate fade-in">
                    ${post.contentHTML || '<p>No content available for this post.</p>'} 
                </div>
                <a href="blog.html" class="btn btn-primary mt-2 scroll-animate fade-in">← Back to Blog</a>
            `;
        } else {
            blogPostFull.innerHTML = '<p>Post not found.</p> <a href="blog.html" class="btn btn-primary mt-2">← Back to Blog</a>';
            document.title = "Post Not Found | Writers Clinic Gambia";
        }
        initScrollAnimations(); 
    } catch (error) {
        console.error("Could not load blog post from Firestore:", error);
        blogPostFull.innerHTML = '<p>Error loading post. Please try again later.</p> <a href="blog.html" class="btn btn-primary mt-2">← Back to Blog</a>';
    }
}


// 8. Basic Form Validation
function initFormValidation() {
    const forms = document.querySelectorAll('form.validate-form');
    forms.forEach(form => {
        form.addEventListener('submit', function(event) {
            if (!validateForm(this)) {
                event.preventDefault();
            } else {
                if (this.id === 'contactForm' || this.id === 'mentorApplicationForm' || this.id === 'menteeApplicationForm') {
                    event.preventDefault(); 
                    alert('Form submitted successfully! (This is a demo)');
                    this.reset();
                    clearAllErrors(this);
                }
            }
        });
    });
}

function validateForm(form) {
    let isValid = true;
    const inputs = form.querySelectorAll('[required], input[type="email"]');
    clearAllErrors(form); 

    inputs.forEach(input => {
        if (input.hasAttribute('required') && !input.value.trim()) {
            showError(input, `${input.previousElementSibling ? input.previousElementSibling.innerText : 'This field'} is required.`);
            isValid = false;
        }
        if (input.type === 'email' && input.value.trim() && !isValidEmail(input.value.trim())) {
            showError(input, 'Please enter a valid email address.');
            isValid = false;
        }
    });
    return isValid;
}

function isValidEmail(email) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function showError(input, message) {
    input.classList.add('invalid');
    let errorElement = input.parentNode.querySelector('.error-message');
    if (!errorElement) {
        errorElement = document.createElement('p');
        errorElement.className = 'error-message';
        if (input.nextSibling) {
            input.parentNode.insertBefore(errorElement, input.nextSibling);
        } else {
            input.parentNode.appendChild(errorElement);
        }
    }
    errorElement.textContent = message;
    errorElement.style.display = 'block';
}

function clearError(input) {
    input.classList.remove('invalid');
    const errorElement = input.parentNode.querySelector('.error-message');
    if (errorElement) {
        errorElement.textContent = '';
        errorElement.style.display = 'none';
    }
}
function clearAllErrors(form) {
    const errorMessages = form.querySelectorAll('.error-message');
    errorMessages.forEach(msg => {
        msg.textContent = '';
        msg.style.display = 'none';
    });
    const invalidInputs = form.querySelectorAll('.invalid');
    invalidInputs.forEach(input => input.classList.remove('invalid'));
}


// Newsletter Signup specific handler
function handleNewsletterSignup() {
    const newsletterForm = document.querySelector('.newsletter-signup form');
    if (newsletterForm) {
        newsletterForm.addEventListener('submit', (event) => {
            event.preventDefault();
            const emailInput = newsletterForm.querySelector('input[type="email"]');
            if (validateForm(newsletterForm)) {
                alert(`Thank you for subscribing with ${emailInput.value}! (This is a demo)`);
                emailInput.value = ''; 
                clearAllErrors(newsletterForm);
            }
        });
    }
}

// Set active navigation link
function setActiveNavLink() {
    const navLinks = document.querySelectorAll('.main-nav a');
    const currentPath = window.location.pathname.split('/').pop() || 'index.html';
    const urlParams = new URLSearchParams(window.location.search);
    const postId = urlParams.get('post');

    navLinks.forEach(link => {
        const linkPath = link.getAttribute('href').split('/').pop();
        if (postId && currentPath === 'blog.html' && linkPath === 'blog.html') {
            link.classList.add('active');
        } else if (!postId && linkPath === currentPath) {
            link.classList.add('active');
        } else {
            link.classList.remove('active');
        }
    });
}

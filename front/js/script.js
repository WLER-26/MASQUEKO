document.addEventListener('DOMContentLoaded', () => {
    if (typeof firebase === 'undefined' || !auth) {
        console.error("Firebase Auth não foi inicializado!");
        return;
    }

    const container = document.getElementById('container');
    const registerBtn = document.getElementById('register');
    const loginBtn = document.getElementById('login');
    const registerForm = document.getElementById('registerForm');
    const loginForm = document.getElementById('loginForm');
    
    // NOVOS BOTÕES MOBILE
    const mobileToRegister = document.getElementById('mobileToRegister');
    const mobileToLogin = document.getElementById('mobileToLogin');

    const forgotPasswordLink = document.getElementById('forgotPasswordLink');
    const forgotPasswordModal = document.getElementById('forgotPasswordModal');
    const closeForgotModalBtn = document.getElementById('closeForgotModal');
    const forgotPasswordForm = document.getElementById('forgotPasswordForm');
    const forgotEmailInput = document.getElementById('forgotEmailInput');

    const isValidEmailFormat = (email) => {
        const regex = /^[a-zA-Z0-9._-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,6}$/;
        return regex.test(email);
    };

    auth.onAuthStateChanged(user => {
        if (user) {
            if (user.emailVerified) {
                if (window.location.pathname === '/' || window.location.pathname.includes('index.html')) {
                     fetchWithAuth('/auth/me')
                        .then(profile => {
                            localStorage.setItem('masqueko-user-profile', JSON.stringify(profile));
                            window.location.href = '/pages/home.html';
                        })
                        .catch(() => console.log("Aguardando perfil..."));
                }
            }
        }
    });

    if (container) {
        // PC
        registerBtn?.addEventListener('click', () => container.classList.add('active'));
        loginBtn?.addEventListener('click', () => container.classList.remove('active'));
        
        // MOBILE
        mobileToRegister?.addEventListener('click', () => container.classList.add('active'));
        mobileToLogin?.addEventListener('click', () => container.classList.remove('active'));
    }

    if (forgotPasswordLink) {
        forgotPasswordLink.addEventListener('click', (e) => {
            e.preventDefault();
            forgotPasswordModal.classList.add('show');
        });
    }
    if (closeForgotModalBtn) {
        closeForgotModalBtn.addEventListener('click', () => forgotPasswordModal.classList.remove('show'));
    }
    window.addEventListener('click', (e) => {
        if (e.target === forgotPasswordModal) forgotPasswordModal.classList.remove('show');
    });

    if (forgotPasswordForm) {
        forgotPasswordForm.addEventListener('submit', async (e) => {
            e.preventDefault();
            const email = forgotEmailInput.value.trim();
            if (!isValidEmailFormat(email)) {
                showNotification('Formato de e-mail inválido.', true);
                return;
            }
            
            const submitBtn = forgotPasswordForm.querySelector('button[type="submit"]');
            submitBtn.disabled = true;
            submitBtn.textContent = "Enviando...";

            try {
                await auth.sendPasswordResetEmail(email);
                showNotification('Link enviado! Verifique seu e-mail.');
                forgotPasswordModal.classList.remove('show');
                forgotEmailInput.value = '';
            } catch (error) {
                showNotification(error.message, true);
            } finally {
                submitBtn.disabled = false;
                submitBtn.textContent = "Enviar Link";
            }
        });
    }

    registerForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const submitBtn = registerForm.querySelector('button');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "Processando...";

        const name = document.getElementById('registerName').value.trim();
        const email = document.getElementById('registerEmail').value.trim();
        const password = document.getElementById('registerPassword').value;

        if (!isValidEmailFormat(email)) {
            showNotification('Por favor, insira um e-mail real.', true);
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
            return;
        }

        try {
            const userCredential = await auth.createUserWithEmailAndPassword(email, password);
            const user = userCredential.user;
            await user.getIdToken(true);

            await fetchWithAuth('/auth/register', {
                method: 'POST',
                body: JSON.stringify({ name, email }),
            });

            await user.sendEmailVerification();
            await auth.signOut();

            showNotification(`Conta criada! Verifique o e-mail enviado para ${email} antes de entrar.`);
            container.classList.remove('active');
            registerForm.reset();

        } catch (error) {
            let msg = error.message;
            if (error.code === 'auth/email-already-in-use') msg = 'Este e-mail já está cadastrado.';
            if (error.code === 'auth/weak-password') msg = 'Senha muito fraca.';
            
            showNotification(msg, true);
            if (auth.currentUser) auth.signOut(); 
        } finally {
            submitBtn.disabled = false;
            submitBtn.textContent = originalBtnText;
        }
    });

    loginForm?.addEventListener('submit', async (e) => {
        e.preventDefault();
        const submitBtn = loginForm.querySelector('button');
        const originalBtnText = submitBtn.textContent;
        submitBtn.disabled = true;
        submitBtn.textContent = "Verificando...";

        const email = document.getElementById('loginEmail').value.trim();
        const password = document.getElementById('loginPassword').value;

        try {
            const userCredential = await auth.signInWithEmailAndPassword(email, password);
            const user = userCredential.user;

            if (!user.emailVerified) {
                showNotification('Conta inativa. Verifique seu e-mail para liberar o acesso.', true);
                await auth.signOut(); 
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
                return;
            }

            const profileData = await fetchWithAuth('/auth/me');
            localStorage.setItem('masqueko-user-profile', JSON.stringify(profileData));
            showNotification('Login realizado com sucesso!');
            
            setTimeout(() => {
                window.location.href = '/pages/home.html';
            }, 1000);

        } catch (error) {
            let msg = error.message;
            if (error.code === 'auth/user-not-found' || error.code === 'auth/wrong-password') msg = 'Email ou senha incorretos.';
            showNotification(msg, true);
        } finally {
            if (!auth.currentUser || !auth.currentUser.emailVerified) {
                submitBtn.disabled = false;
                submitBtn.textContent = originalBtnText;
            }
        }
    });
});
document.addEventListener('DOMContentLoaded', () => {
	const progressBar = document.getElementById('scroll-progress');

	const updateProgressBar = () => {
		if (!progressBar) {
			return;
		}
		const scrollTop = window.scrollY || window.pageYOffset;
		const docHeight = document.documentElement.scrollHeight - window.innerHeight;
		const progress = docHeight > 0 ? Math.min(scrollTop / docHeight, 1) : 0;
		progressBar.style.transform = `scaleX(${progress})`;
	};

	if (progressBar) {
		updateProgressBar();
		window.addEventListener('scroll', updateProgressBar, { passive: true });
		window.addEventListener('resize', updateProgressBar);
	}

	const revealElements = document.querySelectorAll('.reveal-on-scroll');
	const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

	if (reduceMotion) {
		revealElements.forEach((el) => el.classList.add('is-visible'));
	} else if ('IntersectionObserver' in window) {
		const observer = new IntersectionObserver(
			(entries, obs) => {
				entries.forEach((entry) => {
					if (entry.isIntersecting) {
						entry.target.classList.add('is-visible');
						obs.unobserve(entry.target);
					}
				});
			},
			{ threshold: 0.2 }
		);
		revealElements.forEach((el) => observer.observe(el));
	} else {
		revealElements.forEach((el) => el.classList.add('is-visible'));
	}

	const detailTitle = document.getElementById('process-detail-title');
	const detailText = document.getElementById('process-detail-text');
	const featureCards = document.querySelectorAll('.single-features[data-detail-title]');

	const setActiveCard = (card) => {
		if (!detailTitle || !detailText) {
			return;
		}
		featureCards.forEach((item) => item.classList.remove('is-active'));
		card.classList.add('is-active');
		detailTitle.textContent = card.getAttribute('data-detail-title');
		detailText.textContent = card.getAttribute('data-detail-text');
	};

	featureCards.forEach((card, index) => {
		card.addEventListener('mouseenter', () => setActiveCard(card));
		card.addEventListener('focus', () => setActiveCard(card));
		card.addEventListener('click', () => setActiveCard(card));
		card.addEventListener('keydown', (event) => {
			if (event.key === 'Enter' || event.key === ' ') {
				event.preventDefault();
				setActiveCard(card);
			}
		});

		if (index === 0) {
			setActiveCard(card);
		}
	});

	const contactForm = document.getElementById('contact-mailto-form');
	if (contactForm) {
		const recipient = contactForm.getAttribute('data-recipient') || 'support@bourso-parrainage.fr';
		contactForm.addEventListener('submit', (event) => {
			event.preventDefault();
			const formData = new FormData(contactForm);
			const name = (formData.get('name') || '').trim();
			const email = (formData.get('email') || '').trim();
			const phone = (formData.get('phone') || '').trim();
			const subjectInput = (formData.get('subject') || '').trim();
			const message = (formData.get('message') || '').trim();
			const docLink = `${window.location.origin && window.location.origin !== 'null' ? window.location.origin : ''}/docs/dossier-parrainage.pdf`;

			const subject = encodeURIComponent(`Parrainage BoursoBank - ${name || 'Nouveau contact'}`);
			const bodyLines = [
				'Bonjour,',
				'',
				'Je souhaite beneficier de votre offre de parrainage BoursoBank.',
				`Nom / Prenom : ${name || 'non renseigne'}`,
				`Email : ${email || 'non renseigne'}`,
				`Telephone : ${phone || 'non renseigne'}`,
				`Sujet : ${subjectInput || 'non renseigne'}`,
				'',
				'Message :',
				message || '(aucun message ajoute)',
				'',
				'Pieces jointes que je prevois de fournir :',
				'- Piece d\'identite en cours de validite',
				'- RIB a mon nom dans un autre etablissement',
				'- Selfie de verification',
				'- Justificatif de domicile (< 3 mois)',
				'',
				`Checklist PDF : ${docLink}`,
				'',
				'Merci pour votre retour.'
			];

			const mailtoLink = `mailto:${recipient}?subject=${subject}&body=${encodeURIComponent(bodyLines.join('\\n'))}`;
			window.location.href = mailtoLink;
			setTimeout(() => contactForm.reset(), 400);
		});
	}

	const printButton = document.getElementById('print-conditions-btn');
	if (printButton) {
		printButton.addEventListener('click', () => window.print());
	}
});

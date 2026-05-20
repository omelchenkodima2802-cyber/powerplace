document.addEventListener("DOMContentLoaded", () => {
  const themeEffects = document.querySelector("#theme-effects");
  const themeAdminModal = document.querySelector("#theme-admin-modal");
  const themeAdminOpenButtons = document.querySelectorAll("[data-open-theme-modal]");
  const themeAdminCloseButtons = document.querySelectorAll("[data-close-theme-modal]");
  const themeAccessForm = document.querySelector("#theme-access-form");
  const themeAdminPassword = document.querySelector("#theme-admin-password");
  const themeAccessFeedback = document.querySelector("#theme-access-feedback");
  const themeAdminPanel = document.querySelector("#theme-admin-panel");
  const themeOptionButtons = document.querySelectorAll(".theme-option-button");

  if (!themeAdminModal || !themeAccessForm || !themeAdminPanel) {
    return;
  }

  const THEME_STORAGE_KEY = "powerplace-theme";
  const ADMIN_THEME_PASSWORD = "power2024";
  let isThemeAdminAuthorized = false;
  const THEMES = {
    default: { className: "", effect: null, symbols: [] },
    valentines: {
      className: "theme-valentines",
      effect: "hearts",
      symbols: ["❤", "♡", "♥"]
    },
    march8: {
      className: "theme-march8",
      effect: "flower",
      symbols: ["✿", "❀", "✾"]
    },
    april1: { className: "theme-april1", effect: null, symbols: [] },
    independence: { className: "theme-independence", effect: null, symbols: [] },
    newyear: {
      className: "theme-newyear",
      effect: "snow",
      symbols: ["❄", "❅", "✦"]
    },
    easter: {
      className: "theme-easter",
      effect: "easter",
      symbols: ["◌", "◍", "✦"]
    }
  };
  const themeClassNames = Object.values(THEMES)
    .map((theme) => theme.className)
    .filter(Boolean);

  const getStoredValue = (storage, key) => {
    try {
      return storage.getItem(key);
    } catch (error) {
      return null;
    }
  };

  const setStoredValue = (storage, key, value) => {
    try {
      storage.setItem(key, value);
    } catch (error) {
      return;
    }
  };

  const setThemeModalState = (isOpen) => {
    themeAdminModal.classList.toggle("is-open", isOpen);
    themeAdminModal.setAttribute("aria-hidden", String(!isOpen));
    document.body.classList.toggle("theme-modal-open", isOpen);
  };

  const updateThemeAdminAccess = (isUnlocked) => {
    themeAccessForm.hidden = isUnlocked;
    themeAdminPanel.hidden = !isUnlocked;
    themeOptionButtons.forEach((button) => {
      button.disabled = !isUnlocked;
    });

    if (!isUnlocked) {
      themeAccessForm.reset();
    }
  };

  const renderThemeEffects = (themeName) => {
    const theme = THEMES[themeName] || THEMES.default;

    if (!themeEffects) {
      return;
    }

    themeEffects.innerHTML = "";

    if (!theme.effect || theme.symbols.length === 0) {
      return;
    }

    const fragment = document.createDocumentFragment();
    const particleCount = theme.effect === "snow" ? 24 : 16;

    for (let index = 0; index < particleCount; index += 1) {
      const particle = document.createElement("span");
      particle.className = `theme-particle is-${theme.effect}`;
      particle.textContent =
        theme.symbols[Math.floor(Math.random() * theme.symbols.length)];
      particle.style.left = `${Math.random() * 100}%`;
      particle.style.animationDelay = `${Math.random() * -18}s`;
      particle.style.animationDuration = `${12 + Math.random() * 14}s`;
      particle.style.fontSize = `${16 + Math.random() * 14}px`;
      particle.style.setProperty(
        "--particle-drift",
        `${Math.round(Math.random() * 80 - 40)}px`
      );
      fragment.appendChild(particle);
    }

    themeEffects.appendChild(fragment);
  };

  const applyTheme = (themeName, options = {}) => {
    const { persist = true, force = false } = options;
    if (!force && !isThemeAdminAuthorized) {
      return false;
    }

    const selectedTheme = THEMES[themeName] ? themeName : "default";
    const themeConfig = THEMES[selectedTheme];

    document.body.classList.remove(...themeClassNames);
    if (themeConfig.className) {
      document.body.classList.add(themeConfig.className);
    }
    document.body.dataset.theme = selectedTheme;

    themeOptionButtons.forEach((button) => {
      button.classList.toggle("is-active", button.dataset.themeValue === selectedTheme);
    });

    renderThemeEffects(selectedTheme);

    if (persist) {
      setStoredValue(window.localStorage, THEME_STORAGE_KEY, selectedTheme);
    }

    return true;
  };

  const openThemeAdminModal = () => {
    if (themeAccessFeedback) {
      themeAccessFeedback.textContent = "";
      themeAccessFeedback.classList.remove("is-error", "is-success");
    }

    updateThemeAdminAccess(isThemeAdminAuthorized);
    setThemeModalState(true);

    window.setTimeout(() => {
      if (isThemeAdminAuthorized) {
        themeAdminPanel.querySelector(".theme-option-button.is-active")?.focus();
      } else {
        themeAdminPassword?.focus();
      }
    }, 50);
  };

  const closeThemeAdminModal = () => {
    setThemeModalState(false);
  };

  themeAdminOpenButtons.forEach((button) => {
    button.addEventListener("click", () => {
      openThemeAdminModal();
    });
  });

  themeAdminCloseButtons.forEach((button) => {
    button.addEventListener("click", () => {
      closeThemeAdminModal();
    });
  });

  themeAdminModal.addEventListener("click", (event) => {
    if (event.target === themeAdminModal) {
      closeThemeAdminModal();
    }
  });

  document.addEventListener("keydown", (event) => {
    if (event.key === "Escape" && themeAdminModal.classList.contains("is-open")) {
      closeThemeAdminModal();
    }
  });

  themeAccessForm.addEventListener("submit", (event) => {
    event.preventDefault();

    const passwordValue = themeAdminPassword?.value.trim() || "";

    if (themeAccessFeedback) {
      themeAccessFeedback.textContent = "";
      themeAccessFeedback.classList.remove("is-error", "is-success");
    }

    if (passwordValue !== ADMIN_THEME_PASSWORD) {
      if (themeAccessFeedback) {
        themeAccessFeedback.textContent = "Невірний пароль";
        themeAccessFeedback.classList.add("is-error");
      }
      isThemeAdminAuthorized = false;
      updateThemeAdminAccess(false);
      themeAdminPassword?.focus();
      themeAdminPassword?.select();
      return;
    }

    isThemeAdminAuthorized = true;
    updateThemeAdminAccess(true);

    if (themeAccessFeedback) {
      themeAccessFeedback.textContent = "Доступ дозволено. Можна перемикати теми.";
      themeAccessFeedback.classList.add("is-success");
    }

    themeAdminPanel.querySelector(".theme-option-button.is-active")?.focus();
  });

  themeOptionButtons.forEach((button) => {
    button.addEventListener("click", () => {
      if (!isThemeAdminAuthorized) {
        return;
      }

      applyTheme(button.dataset.themeValue);
    });
  });

  const storedTheme = getStoredValue(window.localStorage, THEME_STORAGE_KEY) || "default";
  updateThemeAdminAccess(false);
  applyTheme(storedTheme, { persist: false, force: true });
});

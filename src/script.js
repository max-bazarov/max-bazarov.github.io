class IdsNavbar extends HTMLElement {
  static #items = [];
  static #instances = [];
  static #scrollListenerAdded = false;
  static #ticking = false;

  constructor() {
    super();
    this.classList.add("ids__navbar");
    this.ul = document.createElement("ul");
    this.appendChild(this.ul);
  }

  static updateItems() {
    // Собираем все nav-items
    this.#items = [...document.querySelectorAll(".ids__nav-item")];

    for (const instance of this.#instances) {
      instance.render();
    }

    // Добавляем скролл listener один раз
    if (!this.#scrollListenerAdded) {
      window.addEventListener("scroll", () => this.onScroll());
      this.#scrollListenerAdded = true;
    }

    // При загрузке: если есть hash, обновляем только классы
    if (window.location.hash) {
      this.updateCurrent(true);
    } else {
      this.updateCurrent();
    }
  }

  // Обработчик скролла с throttling
  static onScroll() {
    if (!this.#ticking) {
      this.#ticking = true;
      requestAnimationFrame(() => {
        this.updateCurrent();
        this.#ticking = false;
      });
    }
  }

  // onlyClasses = true → только обновляем классы, не трогаем URL
  static updateCurrent(onlyClasses = false) {
    if (!this.#items.length) return;

    let idToSet = null;

    if (!onlyClasses) {
      // Вычисляем текущий элемент по положению на экране
      let highestIndex = 0;
      for (let i = 0; i < this.#items.length; i++) {
        const { top, bottom } = this.#items[i].getBoundingClientRect();
        const mid = (top + bottom) / 2;

        if (mid < 0) {
          highestIndex = i;
        }
        if (mid >= 0 && mid < window.innerHeight / 2) {
          highestIndex = i;
          break;
        }
      }
      idToSet = this.#items[highestIndex].id;

      // Обновляем URL только если мы реально вычислили элемент
      history.replaceState({}, "", `#${idToSet}`);
    } else {
      // Только обновляем классы, например при загрузке страницы с hash
      const hash = window.location.hash.slice(1);
      if (hash && this.#items.some(item => item.id === hash)) {
        idToSet = hash;
      } else {
        idToSet = this.#items[0].id;
      }
    }

    // Обновляем классы .current у всех navbar инстансов
    for (const instance of this.#instances) {
      instance.querySelectorAll("li").forEach(li => {
        const a = li.querySelector("a");
        li.classList.toggle("current", a.getAttribute("href") === `#${idToSet}`);
      });
    }
  }

  connectedCallback() {
    IdsNavbar.#instances.push(this);
    this.render();
  }

  disconnectedCallback() {
    const idx = IdsNavbar.#instances.indexOf(this);
    if (idx !== -1) IdsNavbar.#instances.splice(idx, 1);
  }

  render() {
    const existingLis = this.ul.querySelectorAll("li");
    const itemsCount = IdsNavbar.#items.length;

    if (existingLis.length !== itemsCount) {
      // Пересоздаем <li> только если количество изменилось
      this.ul.innerHTML = "";
      IdsNavbar.#items.forEach(item => {
        const li = document.createElement("li");
        const a = document.createElement("a");
        a.href = `#${item.id}`;
        a.textContent = item.getAttribute("label") || item.id;
        li.appendChild(a);
        this.ul.appendChild(li);
      });
    }
  }
}

class IdsNavItem extends HTMLElement {
  constructor() {
    super();
    this.classList.add("ids__nav-item");
  }

  connectedCallback() {
    requestAnimationFrame(() => IdsNavbar.updateItems());
  }

  disconnectedCallback() {
    requestAnimationFrame(() => IdsNavbar.updateItems());
  }
}

window.customElements.define("ids-navbar", IdsNavbar);
window.customElements.define("ids-nav-item", IdsNavItem);


/**
 * Get footnote display number
 *
 * @param {number} index - Zero-based footnote index
 * @returns {string} Number starting from 1
 */
function getFootnoteSymbol(index) {
  return (index + 1).toString();
}

/**
 * FootnoteStore - Singleton state management for footnotes
 */
class FootnoteStoreClass {
  #linkRegistry = [];
  #noteRegistry = [];
  #currentIndex = null;
  #subscribers = new Set();

  // Link registry methods
  registerLink(element) {
    this.#linkRegistry.push(element);
    this.#notify();
  }

  unregisterLink(element) {
    const index = this.#linkRegistry.indexOf(element);
    if (index > -1) {
      this.#linkRegistry.splice(index, 1);
      // Close if this was the active footnote
      if (this.#currentIndex === index) {
        this.#currentIndex = null;
      } else if (this.#currentIndex > index) {
        // Adjust current index if it shifted
        this.#currentIndex--;
      }
      this.#notify();
    }
  }

  getLinkIndex(element) {
    return this.#linkRegistry.indexOf(element);
  }

  // Note registry methods
  registerNote(element) {
    this.#noteRegistry.push(element);
    this.#notify();
  }

  unregisterNote(element) {
    const index = this.#noteRegistry.indexOf(element);
    if (index > -1) {
      this.#noteRegistry.splice(index, 1);
      this.#notify();
    }
  }

  getNoteIndex(element) {
    return this.#noteRegistry.indexOf(element);
  }

  // Current index getter/setter
  get currentIndex() {
    return this.#currentIndex;
  }

  set currentIndex(value) {
    if (this.#currentIndex !== value) {
      this.#currentIndex = value;
      this.#notify();
    }
  }

  // Public registry access (read-only)
  get linkRegistry() {
    return [...this.#linkRegistry];
  }

  get noteRegistry() {
    return [...this.#noteRegistry];
  }

  // Subscription methods
  subscribe(callback) {
    this.#subscribers.add(callback);
  }

  unsubscribe(callback) {
    this.#subscribers.delete(callback);
  }

  #notify() {
    this.#subscribers.forEach((callback) => {
      try {
        callback();
      } catch (error) {
        console.error("FootnoteStore subscriber error:", error);
      }
    });
  }
}

// Export singleton instance
const FootnoteStore = new FootnoteStoreClass();

/**
 * IdsFootnoteLink - Clickable footnote trigger with auto-numbered badge
 */
class IdsFootnoteLink extends HTMLElement {
  #button = null;
  #label = null;

  connectedCallback() {
    // Create DOM structure
    this.#label = document.createElement("label");
    this.#button = document.createElement("button");
    this.#button.className = "ids-footnote-link__button";

    // Move existing content to label (before button)
    while (this.firstChild) {
      this.#label.appendChild(this.firstChild);
    }

    this.#label.appendChild(this.#button);
    this.appendChild(this.#label);

    // Register in store
    FootnoteStore.registerLink(this);

    // Setup click handler
    this.#button.addEventListener("click", this.#handleClick);

    // Subscribe to store updates
    FootnoteStore.subscribe(this.#update);

    this.#update();
  }

  disconnectedCallback() {
    FootnoteStore.unregisterLink(this);
    FootnoteStore.unsubscribe(this.#update);
    this.#button?.removeEventListener("click", this.#handleClick);
  }

  #handleClick = (e) => {
    e.preventDefault();
    e.stopPropagation();
    this.toggle();
  };

  #update = () => {
    const index = FootnoteStore.getLinkIndex(this);
    const isOpen = FootnoteStore.currentIndex === index;
    const symbol = getFootnoteSymbol(index);

    this.#button.textContent = symbol;
    this.#button.setAttribute("aria-expanded", isOpen);
    this.#button.setAttribute("aria-controls", `ids-footnote-${index}`);
    this.#button.classList.toggle("open", isOpen);
    this.#button.classList.toggle("enlarge", index >= 10);
  };

  get index() {
    return FootnoteStore.getLinkIndex(this);
  }

  get symbol() {
    return getFootnoteSymbol(this.index);
  }

  get isOpen() {
    return FootnoteStore.currentIndex === this.index;
  }

  toggle() {
    const index = this.index;
    FootnoteStore.currentIndex =
      FootnoteStore.currentIndex === index ? null : index;
    this.dispatchEvent(
      new CustomEvent("ids-footnote-toggle", {
        detail: { index, open: this.isOpen },
        bubbles: true,
      }),
    );
  }

  open() {
    FootnoteStore.currentIndex = this.index;
  }

  close() {
    if (this.isOpen) {
      FootnoteStore.currentIndex = null;
    }
  }
}
class IdsNavbar extends HTMLElement {
  static #items = [];
  static #instances = [];

  constructor() {
    super();
    this.classList.add("ids__navbar");
    this.render();
  }

  static updateItems() {
    // Сейчас оно будет запускаться слишком часто, нужно будет переделать
    this.#items = [...document.querySelectorAll(".ids__nav-item")];
    for (const instance of this.#instances) {
      instance.render();
    }
    this.updateCurrent();
  }

  static updateCurrent() {
    let highestTopPositionIndex = 0;
    for (let i = 0; i < this.#items.length; i++) {
      let { bottom, top } = this.#items[i].getBoundingClientRect() ?? {
        top: 0,
        bottom: 0,
      };
      let topPosition = (top + bottom) / 2;
      if (topPosition < 0) {
        highestTopPositionIndex = i;
      }
      if (topPosition >= 0 && topPosition < window.innerHeight / 2) {
        highestTopPositionIndex = i;
        break;
      }
    }
    let id = this.#items[highestTopPositionIndex].getAttribute("id");
    history.replaceState({}, "", `#${id}`);
    for (const instance of this.#instances) {
      for (const /** @type {HTMLElement} */ li of instance.querySelectorAll("li:has(a)")) {
        li.classList.toggle("current", li.firstElementChild.getAttribute("href") === "#" + id);
      }
    }
  }

  connectedCallback() {
    IdsNavbar.#instances.push(this);
  }

  disconnectedCallback() {
    IdsNavbar.#instances.splice(IdsNavbar.#instances.indexOf(this), 1);
  }

  render() {
    // Тут стоит делать через манипуляции с dom и не пересоздавать одни и те же записи по 100 раз
    this.innerHTML = `
            <ul>
                ${IdsNavbar.#items
        .map(
          (item) => `
                    <li>
                        <a href="#${item.getAttribute("id")}">
                            ${item.getAttribute("label")}
                        </a>
                    </li>
                `
        )
        .join("")}
            </ul>
          `;
  }
}

// TODO можно добавлять/убирать этот лисенер
document.addEventListener("scroll", () => IdsNavbar.updateCurrent());

class IdsNavItem extends HTMLElement {
  constructor() {
    super();
    this.classList.add("ids__nav-item");
  }

  connectedCallback() {
    IdsNavbar.updateItems();
  }
  disconnectedCallback() {
    IdsNavbar.updateItems();
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
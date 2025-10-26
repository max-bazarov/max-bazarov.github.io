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
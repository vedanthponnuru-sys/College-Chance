const MAX_LIST_HEIGHT = 280;
const MIN_LIST_HEIGHT = 120;
const EDGE_GAP = 8;

let comboboxCount = 0;

function normalizeOption(option) {
  if (typeof option === "string") return { value: option, label: option, detail: "", keywords: [] };
  return {
    value: option.value,
    label: option.label || option.value,
    detail: option.detail || "",
    keywords: option.keywords || []
  };
}

function matches(option, query) {
  if (!query) return true;
  const q = query.toLowerCase();
  return option.label.toLowerCase().includes(q) || option.keywords.some((k) => k.toLowerCase().startsWith(q));
}

export function createCombobox(input, { options = [], onSelect = () => {}, emptyText = "No matches — press Enter to use what you typed" } = {}) {
  comboboxCount += 1;
  const listId = `combobox-list-${comboboxCount}`;

  const wrapper = document.createElement("div");
  wrapper.className = "combobox";
  input.parentNode.insertBefore(wrapper, input);
  wrapper.appendChild(input);

  const list = document.createElement("ul");
  list.className = "combobox-list";
  list.id = listId;
  list.setAttribute("role", "listbox");
  list.hidden = true;
  wrapper.appendChild(list);

  input.setAttribute("role", "combobox");
  input.setAttribute("aria-autocomplete", "list");
  input.setAttribute("aria-expanded", "false");
  input.setAttribute("aria-controls", listId);
  input.setAttribute("autocomplete", "off");

  let allOptions = options.map(normalizeOption);
  let visible = [];
  let activeIndex = -1;

  function isOpen() {
    return !list.hidden;
  }

  function setActive(index) {
    activeIndex = index;
    Array.from(list.querySelectorAll('[role="option"]')).forEach((el, i) => {
      const active = i === index;
      el.classList.toggle("active", active);
      el.setAttribute("aria-selected", String(active));
      if (active) {
        input.setAttribute("aria-activedescendant", el.id);
        const top = el.offsetTop;
        const bottom = top + el.offsetHeight;
        if (top < list.scrollTop) list.scrollTop = top;
        else if (bottom > list.scrollTop + list.clientHeight) list.scrollTop = bottom - list.clientHeight;
      }
    });
    if (index < 0) input.removeAttribute("aria-activedescendant");
  }

  function render() {
    visible = allOptions.filter((option) => matches(option, input.value.trim()));
    list.innerHTML = "";

    if (visible.length === 0) {
      const empty = document.createElement("li");
      empty.className = "combobox-empty";
      empty.textContent = emptyText;
      list.appendChild(empty);
    }

    visible.forEach((option, i) => {
      const li = document.createElement("li");
      li.id = `${listId}-option-${i}`;
      li.className = "combobox-option";
      li.setAttribute("role", "option");
      li.setAttribute("aria-selected", "false");
      li.textContent = option.label;
      if (option.detail) {
        const detail = document.createElement("span");
        detail.className = "combobox-option-detail";
        detail.textContent = option.detail;
        li.appendChild(detail);
      }
      li.addEventListener("mousedown", (event) => event.preventDefault());
      li.addEventListener("mousemove", () => {
        if (activeIndex !== i) setActive(i);
      });
      li.addEventListener("click", () => choose(i));
      list.appendChild(li);
    });

    activeIndex = -1;
    input.removeAttribute("aria-activedescendant");
  }

  function position() {
    const inputRect = input.getBoundingClientRect();
    const container = input.closest(".overlay-card");
    const containerRect = container ? container.getBoundingClientRect() : null;
    const bottomLimit = Math.min(window.innerHeight, containerRect ? containerRect.bottom : Infinity) - EDGE_GAP;
    const topLimit = Math.max(0, containerRect ? containerRect.top : 0) + EDGE_GAP;

    list.style.maxHeight = `${MAX_LIST_HEIGHT}px`;
    const wanted = Math.min(list.scrollHeight, MAX_LIST_HEIGHT);
    const spaceBelow = bottomLimit - inputRect.bottom;
    const spaceAbove = inputRect.top - topLimit;
    const openAbove = spaceBelow < wanted && spaceAbove > spaceBelow;
    const space = openAbove ? spaceAbove : spaceBelow;

    wrapper.classList.toggle("open-above", openAbove);
    list.style.maxHeight = `${Math.max(MIN_LIST_HEIGHT, Math.min(MAX_LIST_HEIGHT, space - 4))}px`;
  }

  function open() {
    render();
    list.hidden = false;
    input.setAttribute("aria-expanded", "true");
    position();
  }

  function close() {
    list.hidden = true;
    input.setAttribute("aria-expanded", "false");
    input.removeAttribute("aria-activedescendant");
    activeIndex = -1;
  }

  function choose(index) {
    const option = visible[index];
    if (!option) return;
    input.value = option.value;
    close();
    input.dispatchEvent(new Event("change", { bubbles: true }));
    onSelect(option.value);
  }

  input.addEventListener("input", () => {
    open();
  });

  input.addEventListener("click", () => {
    if (!isOpen()) open();
  });

  input.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      if (!isOpen()) open();
      if (visible.length > 0) setActive(Math.min(activeIndex + 1, visible.length - 1));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      if (!isOpen()) open();
      if (visible.length > 0) setActive(Math.max(activeIndex - 1, 0));
    } else if (event.key === "Enter") {
      if (!isOpen()) return;
      event.preventDefault();
      if (activeIndex >= 0) {
        choose(activeIndex);
      } else {
        close();
        input.dispatchEvent(new Event("change", { bubbles: true }));
        onSelect(input.value.trim());
      }
    } else if (event.key === "Escape") {
      if (isOpen()) {
        event.preventDefault();
        event.stopPropagation();
        close();
      }
    } else if (event.key === "Tab") {
      close();
    }
  });

  document.addEventListener("pointerdown", (event) => {
    if (isOpen() && !wrapper.contains(event.target)) close();
  });

  window.addEventListener("resize", () => {
    if (isOpen()) position();
  });

  return {
    setOptions(newOptions) {
      allOptions = newOptions.map(normalizeOption);
      if (isOpen()) {
        render();
        position();
      }
    },
    close,
    open
  };
}

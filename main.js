const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];

const symbols = {
  dilution: "C₁V₁ = C₂V₂",
  molarity: "M = m ÷ (PM × V)",
  normality: "N = M × n"
};

let activeTab = "dilution";
const numberFormat = new Intl.NumberFormat("es-CO", { maximumSignificantDigits: 7 });

function fmt(value) {
  if (!Number.isFinite(value)) return "—";
  const absolute = Math.abs(value);
  if (absolute !== 0 && (absolute < 0.000001 || absolute >= 1000000000)) {
    const [mantissa, exponent] = value.toExponential(5).split("e");
    const cleanMantissa = Number(mantissa).toString().replace(".", ",");
    const superscripts = { "-": "⁻", "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹" };
    const prettyExponent = [...exponent.replace("+", "")]
      .map(character => superscripts[character] || character).join("");
    return `${cleanMantissa} × 10${prettyExponent}`;
  }
  return numberFormat.format(value);
}

function positive(id) {
  const raw = $(id).value.trim().replace(/\s/g, "").replace(",", ".");
  if (!raw) return null;
  const value = Number(raw);
  return Number.isFinite(value) && value > 0 ? value : null;
}

function toLiters(id, unitId) {
  const value = positive(id);
  return value === null ? null : value * ($(unitId).value === "L" ? 1 : 0.001);
}

function toGrams(id, unitId) {
  const value = positive(id);
  return value === null ? null : value * ($(unitId).value === "g" ? 1 : 0.001);
}

function toMolar(id, unitId) {
  const value = positive(id);
  if (value === null) return null;
  const factors = { M: 1, mM: 0.001, uM: 0.000001 };
  return value * factors[$(unitId).value];
}

function volumeResult(liters) {
  return liters >= 1
    ? { value: `${fmt(liters)} L`, alternative: `${fmt(liters * 1000)} mL` }
    : { value: `${fmt(liters * 1000)} mL`, alternative: `${fmt(liters)} L` };
}

function massResult(grams) {
  return grams >= 1
    ? { value: `${fmt(grams)} g`, alternative: `${fmt(grams * 1000)} mg` }
    : { value: `${fmt(grams * 1000)} mg`, alternative: `${fmt(grams)} g` };
}

function clearError(prefix) {
  $(`#${prefix}-error`).hidden = true;
  $(`#${prefix}-error`).textContent = "";
}

function showError(prefix, message) {
  const element = $(`#${prefix}-error`);
  element.textContent = message;
  element.hidden = false;
  resetResult();
}

function resetResult() {
  $("#result-empty").hidden = false;
  $("#result-content").hidden = true;
  $("#empty-symbol").textContent = symbols[activeTab];
  $("#copy-result").textContent = "Copiar resultado";
}

function showResult({ label, value, extra = [], steps }) {
  $("#result-empty").hidden = true;
  $("#result-content").hidden = false;
  $("#result-label").textContent = label;
  $("#result-value").textContent = value;
  $("#result-extra").innerHTML = extra.map(item => `<p>${item}</p>`).join("");
  $("#result-steps").innerHTML = steps.map(step => `<li>${step.text}<span class="math">${step.math}</span></li>`).join("");
  $("#copy-result").textContent = "Copiar resultado";

  if (window.innerWidth < 900) {
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    $(".result-panel").scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
  }
}

function switchTab(nextTab, focus = false) {
  activeTab = nextTab;
  $$("[data-tab]").forEach(button => {
    const selected = button.dataset.tab === nextTab;
    button.setAttribute("aria-selected", String(selected));
    button.tabIndex = selected ? 0 : -1;
    if (selected && focus) button.focus();
  });
  $$(".calculator-panel").forEach(panel => {
    panel.hidden = panel.id !== `panel-${nextTab}`;
  });
  resetResult();
}

$$("[data-tab]").forEach(button => {
  button.addEventListener("click", () => switchTab(button.dataset.tab));
  button.addEventListener("keydown", event => {
    const tabs = $$("[data-tab]");
    const current = tabs.indexOf(button);
    let next = null;
    if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
    if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
    if (event.key === "Home") next = 0;
    if (event.key === "End") next = tabs.length - 1;
    if (next !== null) {
      event.preventDefault();
      switchTab(tabs[next].dataset.tab, true);
    }
  });
});

function syncDilution() {
  const target = $("#d-target").value;
  $$("[data-d-field]").forEach(field => {
    field.hidden = field.dataset.dField === target;
  });
  $$("[data-d-unit]").forEach(unit => { unit.textContent = $("#d-unit").value; });
  clearError("d");
  resetResult();
}

function syncMolarity() {
  const prepare = $("#m-mode").value === "prepare";
  $("[data-m-field='concentration']").hidden = !prepare;
  $("[data-m-field='mass']").hidden = prepare;
  clearError("m");
  resetResult();
}

function syncNormality() {
  const mode = $("#n-mode").value;
  const visible = {
    convert: ["molarity"],
    prepare: ["normality", "volume", "pm"],
    calculate: ["mass", "volume", "pm"]
  }[mode];
  $$("[data-n-field]").forEach(field => {
    field.hidden = !visible.includes(field.dataset.nField);
  });
  clearError("n");
  resetResult();
}

$("#d-target").addEventListener("change", syncDilution);
$("#d-unit").addEventListener("change", syncDilution);
$("#m-mode").addEventListener("change", syncMolarity);
$("#n-mode").addEventListener("change", syncNormality);

$("#form-dilution").addEventListener("submit", event => {
  event.preventDefault();
  clearError("d");
  const target = $("#d-target").value;
  const unit = $("#d-unit").value;
  const rawVolumes = {
    v1: positive("#d-v1"),
    v2: positive("#d-v2")
  };
  const values = {
    c1: positive("#d-c1"),
    c2: positive("#d-c2"),
    v1: toLiters("#d-v1", "#d-v1-unit"),
    v2: toLiters("#d-v2", "#d-v2-unit")
  };

  for (const key of Object.keys(values)) {
    if (key !== target && values[key] === null) {
      showError("d", "Completa todos los datos visibles con números mayores que cero. Revisa también las comas decimales.");
      return;
    }
  }

  if (target === "v1") values.v1 = values.c2 * values.v2 / values.c1;
  if (target === "v2") values.v2 = values.c1 * values.v1 / values.c2;
  if (target === "c2") values.c2 = values.c1 * values.v1 / values.v2;
  if (target === "c1") values.c1 = values.c2 * values.v2 / values.v1;

  if (values.c2 > values.c1 || values.v1 > values.v2) {
    showError("d", "Estos datos describen una concentración, no una dilución. Normalmente C₂ debe ser menor que C₁ y V₁ no puede superar V₂. Revisa los valores.");
    return;
  }

  const dilutionFactor = values.c1 / values.c2;
  const solvent = values.v2 - values.v1;
  const extra = [
    `<strong>Factor de dilución:</strong> 1:${fmt(dilutionFactor)}`,
    `<strong>Solvente estimado (V₂ − V₁):</strong> ${fmt(solvent * 1000)} mL. Para preparar, afora hasta el volumen final.`
  ];
  let label;
  let value;
  let steps;

  if (target === "v1" || target === "v2") {
    const result = volumeResult(values[target]);
    const targetName = target === "v1" ? "volumen de solución concentrada" : "volumen final";
    const formula = target === "v1" ? "V₁ = (C₂ × V₂) ÷ C₁" : "V₂ = (C₁ × V₁) ÷ C₂";
    const numerator = target === "v1"
      ? `${fmt(values.c2)} ${unit} × ${fmt(values.v2)} L`
      : `${fmt(values.c1)} ${unit} × ${fmt(values.v1)} L`;
    const denominator = target === "v1" ? values.c1 : values.c2;
    label = target === "v1" ? "V₁ — volumen de solución concentrada" : "V₂ — volumen final";
    value = result.value;
    extra.unshift(`<strong>Equivale a:</strong> ${result.alternative}`);
    steps = [
      { text: "Usa la misma unidad para C₁ y C₂. Convierte los volúmenes a litros.", math: `V₁ = ${fmt(values.v1)} L · V₂ = ${fmt(values.v2)} L` },
      { text: `Despeja el ${targetName}.`, math: formula },
      { text: "Reemplaza y resuelve.", math: `${target.toUpperCase()} = (${numerator}) ÷ ${fmt(denominator)} ${unit} = ${fmt(values[target])} L` }
    ];
  } else {
    const formula = target === "c2" ? "C₂ = (C₁ × V₁) ÷ V₂" : "C₁ = (C₂ × V₂) ÷ V₁";
    const numerator = target === "c2"
      ? `${fmt(values.c1)} ${unit} × ${fmt(values.v1)} L`
      : `${fmt(values.c2)} ${unit} × ${fmt(values.v2)} L`;
    const denominator = target === "c2" ? values.v2 : values.v1;
    label = target === "c2" ? "C₂ — concentración final" : "C₁ — concentración inicial";
    value = `${fmt(values[target])} ${unit}`;
    steps = [
      { text: "Verifica que ambas concentraciones usen la misma unidad y convierte los volúmenes a litros.", math: `V₁ = ${fmt(values.v1)} L · V₂ = ${fmt(values.v2)} L` },
      { text: "Despeja la concentración buscada.", math: formula },
      { text: "Reemplaza y resuelve.", math: `${target.toUpperCase()} = (${numerator}) ÷ ${fmt(denominator)} L = ${fmt(values[target])} ${unit}` }
    ];
  }
  showResult({ label, value, extra, steps });
});

$("#form-molarity").addEventListener("submit", event => {
  event.preventDefault();
  clearError("m");
  const mode = $("#m-mode").value;
  const volume = toLiters("#m-volume", "#m-volume-unit");
  const pm = positive("#m-pm");
  const rawVolume = positive("#m-volume");
  const volumeUnit = $("#m-volume-unit").value;

  if (volume === null || pm === null) {
    showError("m", "Completa el volumen y el peso molar con números mayores que cero.");
    return;
  }

  if (mode === "prepare") {
    const concentrationRaw = positive("#m-concentration");
    const concentration = toMolar("#m-concentration", "#m-concentration-unit");
    if (concentration === null) {
      showError("m", "Escribe una molaridad deseada mayor que cero.");
      return;
    }
    const concentrationUnit = $("#m-concentration-unit").value;
    const mass = concentration * volume * pm;
    const moles = concentration * volume;
    const result = massResult(mass);
    showResult({
      label: "Masa de soluto necesaria",
      value: result.value,
      extra: [`<strong>Equivale a:</strong> ${result.alternative}`, `<strong>Cantidad de soluto:</strong> ${fmt(moles)} mol`],
      steps: [
        { text: "Convierte el volumen a litros y la concentración a mol/L.", math: `${fmt(rawVolume)} ${volumeUnit} = ${fmt(volume)} L · M = ${fmt(concentration)} mol/L` },
        { text: "Despeja la masa de M = m ÷ (PM × V).", math: "m = M × PM × V" },
        { text: "Reemplaza y resuelve.", math: `m = ${fmt(concentration)} mol/L × ${fmt(pm)} g/mol × ${fmt(volume)} L = ${fmt(mass)} g` }
      ]
    });
  } else {
    const mass = toGrams("#m-mass", "#m-mass-unit");
    const rawMass = positive("#m-mass");
    if (mass === null) {
      showError("m", "Escribe una masa de soluto mayor que cero.");
      return;
    }
    const massUnit = $("#m-mass-unit").value;
    const concentration = mass / (pm * volume);
    const moles = mass / pm;
    showResult({
      label: "Molaridad de la solución",
      value: `${fmt(concentration)} M`,
      extra: [`<strong>Equivale a:</strong> ${fmt(concentration * 1000)} mM`, `<strong>Cantidad de soluto:</strong> ${fmt(moles)} mol`],
      steps: [
        { text: "Convierte la masa a gramos y el volumen a litros.", math: `${fmt(rawMass)} ${massUnit} = ${fmt(mass)} g · ${fmt(rawVolume)} ${volumeUnit} = ${fmt(volume)} L` },
        { text: "Usa la relación entre masa, peso molar y volumen.", math: "M = m ÷ (PM × V)" },
        { text: "Reemplaza y resuelve.", math: `M = ${fmt(mass)} g ÷ (${fmt(pm)} g/mol × ${fmt(volume)} L) = ${fmt(concentration)} mol/L` }
      ]
    });
  }
});

$("#form-normality").addEventListener("submit", event => {
  event.preventDefault();
  clearError("n");
  const mode = $("#n-mode").value;
  const factor = positive("#n-factor");
  if (factor === null) {
    showError("n", "Escribe el factor n con un número mayor que cero. Recuerda que depende de la reacción.");
    return;
  }

  if (mode === "convert") {
    const molarity = positive("#n-molarity");
    if (molarity === null) {
      showError("n", "Escribe una molaridad mayor que cero.");
      return;
    }
    const normality = molarity * factor;
    showResult({
      label: "Normalidad de la solución",
      value: `${fmt(normality)} N`,
      extra: [`<strong>Unidad:</strong> ${fmt(normality)} eq/L`],
      steps: [
        { text: "Relaciona molaridad y normalidad mediante el factor n.", math: "N = M × n" },
        { text: "Reemplaza la molaridad y los equivalentes por mol.", math: `N = ${fmt(molarity)} mol/L × ${fmt(factor)} eq/mol` },
        { text: "Resuelve conservando la unidad eq/L.", math: `N = ${fmt(normality)} eq/L` }
      ]
    });
    return;
  }

  const volume = toLiters("#n-volume", "#n-volume-unit");
  const pm = positive("#n-pm");
  const rawVolume = positive("#n-volume");
  const volumeUnit = $("#n-volume-unit").value;
  if (volume === null || pm === null) {
    showError("n", "Completa el volumen y el peso molar con números mayores que cero.");
    return;
  }

  if (mode === "prepare") {
    const normality = positive("#n-normality");
    if (normality === null) {
      showError("n", "Escribe una normalidad deseada mayor que cero.");
      return;
    }
    const mass = normality * volume * pm / factor;
    const molarity = normality / factor;
    const equivalents = normality * volume;
    const result = massResult(mass);
    showResult({
      label: "Masa de soluto necesaria",
      value: result.value,
      extra: [`<strong>Equivale a:</strong> ${result.alternative}`, `<strong>Molaridad:</strong> ${fmt(molarity)} M · <strong>Equivalentes:</strong> ${fmt(equivalents)} eq`],
      steps: [
        { text: "Convierte el volumen a litros.", math: `${fmt(rawVolume)} ${volumeUnit} = ${fmt(volume)} L` },
        { text: "Despeja la masa de N = (m × n) ÷ (PM × V).", math: "m = (N × PM × V) ÷ n" },
        { text: "Reemplaza y resuelve.", math: `m = (${fmt(normality)} eq/L × ${fmt(pm)} g/mol × ${fmt(volume)} L) ÷ ${fmt(factor)} eq/mol = ${fmt(mass)} g` }
      ]
    });
  } else {
    const mass = toGrams("#n-mass", "#n-mass-unit");
    const rawMass = positive("#n-mass");
    if (mass === null) {
      showError("n", "Escribe una masa de soluto mayor que cero.");
      return;
    }
    const massUnit = $("#n-mass-unit").value;
    const normality = mass * factor / (pm * volume);
    const molarity = normality / factor;
    const equivalents = normality * volume;
    showResult({
      label: "Normalidad de la solución",
      value: `${fmt(normality)} N`,
      extra: [`<strong>Molaridad:</strong> ${fmt(molarity)} M · <strong>Equivalentes:</strong> ${fmt(equivalents)} eq`],
      steps: [
        { text: "Convierte la masa a gramos y el volumen a litros.", math: `${fmt(rawMass)} ${massUnit} = ${fmt(mass)} g · ${fmt(rawVolume)} ${volumeUnit} = ${fmt(volume)} L` },
        { text: "Usa la relación entre equivalentes, masa y volumen.", math: "N = (m × n) ÷ (PM × V)" },
        { text: "Reemplaza y resuelve.", math: `N = (${fmt(mass)} g × ${fmt(factor)} eq/mol) ÷ (${fmt(pm)} g/mol × ${fmt(volume)} L) = ${fmt(normality)} eq/L` }
      ]
    });
  }
});

$$("form").forEach(form => {
  form.addEventListener("input", () => clearError(form.id.startsWith("form-d") ? "d" : form.id.startsWith("form-m") ? "m" : "n"));
  form.addEventListener("reset", () => {
    requestAnimationFrame(() => {
      if (form.id === "form-dilution") syncDilution();
      if (form.id === "form-molarity") syncMolarity();
      if (form.id === "form-normality") syncNormality();
      resetResult();
    });
  });
});

$("#copy-result").addEventListener("click", async () => {
  const text = [
    `${$("#result-label").textContent}: ${$("#result-value").textContent}`,
    $("#result-extra").innerText,
    "Procedimiento:",
    $("#result-steps").innerText,
    "Calculado con Manrique Pharma"
  ].filter(Boolean).join("\n");
  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      const copied = document.execCommand("copy");
      textarea.remove();
      if (!copied) throw new Error("copy unavailable");
    }
    $("#copy-result").textContent = "¡Copiado!";
  } catch {
    $("#copy-result").textContent = "Selecciona y copia el resultado";
  }
});

function createSparkles() {
  const field = $("#sparkle-field");
  const fragment = document.createDocumentFragment();
  const colors = ["#f8d97a", "#c88cff"];
  for (let index = 0; index < 44; index += 1) {
    const star = document.createElement("img");
    star.className = "sparkle png-star";
    star.src = index % 2 === 0 ? "./destello-blanco.png" : "./destello-morado.png";
    star.alt = "";
    star.decoding = "async";
    star.style.setProperty("--x", `${(index * 37.7 + 13) % 100}%`);
    star.style.setProperty("--y", `${(index * 61.3 + 7) % 100}%`);
    star.style.setProperty("--size", `${10 + (index * 7) % 18}px`);
    star.style.setProperty("--spark", colors[index % colors.length]);
    star.style.setProperty("--duration", `${2.8 + (index % 7) * 0.55}s`);
    star.style.setProperty("--delay", `${-(index % 11) * 0.63}s`);
    fragment.appendChild(star);
  }
  field.appendChild(fragment);
}

createSparkles();
syncDilution();
syncMolarity();
syncNormality();
switchTab("dilution");

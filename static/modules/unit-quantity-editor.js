// #Issue133: Keep the base quantity in the editor, independently of rounded display values.
// WeakMap entries expire with the input when a line is saved or rendered again.
const quantityEditors = new WeakMap();

export function getUnitQuantityBase(input, factor, item) {
  const quantity = Number(input?.value);
  const editor = input && quantityEditors.get(input);
  if (editor && input.value === editor.displayValue) return editor.baseQuantity;
  if (!editor && item && quantity === Number(item.inputQuantity ?? item.input_quantity ?? item.quantity)) {
    return Number(item.quantity);
  }
  return quantity * (editor?.factor ?? factor);
}

export function convertUnitQuantity(input, oldFactor, newFactor, item) {
  if (!input) return;
  const baseQuantity = getUnitQuantityBase(input, oldFactor, item);
  if (input.value !== "" && Number.isFinite(baseQuantity) && baseQuantity > 0) {
    const quantity = baseQuantity / newFactor;
    // Do not turn a positive quantity into zero for large conversion factors.
    input.value = Number(quantity.toFixed(4)) || quantity;
  }
  quantityEditors.set(input, { factor: newFactor, baseQuantity, displayValue: input.value });
}

// BR-03 / FR-23: todo valor monetario se muestra en COP.
export function formatCOP(value: number): string {
  return `$ ${Math.round(value || 0).toLocaleString('es-CO')} COP`;
}

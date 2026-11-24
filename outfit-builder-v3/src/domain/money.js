// BR-03 / FR-23: todo valor monetario se muestra en COP.
export const formatCOP = n => '$ ' + Math.round(n).toLocaleString('es-CO') + ' COP';

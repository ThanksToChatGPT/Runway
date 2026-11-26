import { formatCOP } from '@/domain/money';

export default function Price({ priceCop }: { priceCop: number }) {
  return <>{formatCOP(priceCop)}</>;
}

import {formatCOP} from '../../domain/money.js';
export default function Price({p}) { return <>{p.priceEstimated && '≈ '}{formatCOP(p.price)}</>; }

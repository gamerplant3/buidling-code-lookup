/**
 * Apply Cohere-generated filter plan to site array (client-side).
 */

function getNested(obj, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), obj);
}

function compare(op, left, right) {
  if (left == null) return false;

  switch (op) {
    case 'eq':
      return left === right;
    case 'neq':
      return left !== right;
    case 'gt':
      return Number(left) > Number(right);
    case 'gte':
      return Number(left) >= Number(right);
    case 'lt':
      return Number(left) < Number(right);
    case 'lte':
      return Number(left) <= Number(right);
    case 'in': {
      const arr = Array.isArray(right) ? right : [right];
      const norm = (v) => String(v).toLowerCase();
      return arr.map(norm).includes(norm(left));
    }
    case 'contains':
      return String(left).toLowerCase().includes(String(right).toLowerCase());
    default:
      return true;
  }
}

export function applyFilterPlan(sites, plan) {
  if (!plan || !Array.isArray(plan.filters) || plan.filters.length === 0) {
    return { sites, matched: sites.length };
  }

  const filtered = sites.filter((site) =>
    plan.filters.every((f) => {
      const value = getNested(site, f.field);
      return compare(f.op || 'eq', value, f.value);
    })
  );

  if (plan.sort && plan.sort.field) {
    const { field, dir } = plan.sort;
    filtered.sort((a, b) => {
      const av = getNested(a, field);
      const bv = getNested(b, field);
      if (av === bv) return 0;
      const cmp = av > bv ? 1 : -1;
      return dir === 'desc' ? -cmp : cmp;
    });
  }

  return { sites: filtered, matched: filtered.length };
}

// Opaque cursor encodes the last item's createdAt + id for stable keyset paging.
import { Op } from 'sequelize';

export function encodeCursor(obj) {
  return Buffer.from(JSON.stringify(obj), 'utf8').toString('base64url');
}

export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    return JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
  } catch {
    return null;
  }
}

/**
 * Keyset pagination over a Sequelize model ordered by (createdAt DESC, id DESC).
 * @returns { data, pagination }
 */
export async function paginate(model, { where = {}, limit = 20, cursor, include } = {}, mapFn) {
  const decoded = decodeCursor(cursor);
  const effectiveWhere = { ...where };

  if (decoded && decoded.createdAt && decoded.id) {
    effectiveWhere[Op.and] = [
      ...(effectiveWhere[Op.and] || []),
      {
        [Op.or]: [
          { createdAt: { [Op.lt]: decoded.createdAt } },
          {
            createdAt: decoded.createdAt,
            id: { [Op.lt]: decoded.id },
          },
        ],
      },
    ];
  }

  // Fetch limit + 1 to determine if there are more pages.
  const rows = await model.findAll({
    where: effectiveWhere,
    include,
    order: [
      ['createdAt', 'DESC'],
      ['id', 'DESC'],
    ],
    limit: limit + 1,
  });

  const hasMore = rows.length > limit;
  const page = hasMore ? rows.slice(0, limit) : rows;

  const totalCount = await model.count({ where });

  let nextCursor = null;
  if (hasMore) {
    const last = page[page.length - 1];
    nextCursor = encodeCursor({
      createdAt: last.createdAt instanceof Date ? last.createdAt.toISOString() : last.createdAt,
      id: last.id,
    });
  }

  return {
    data: mapFn ? page.map(mapFn) : page,
    pagination: {
      totalCount,
      hasMore,
      nextCursor,
      prevCursor: cursor || null,
    },
  };
}

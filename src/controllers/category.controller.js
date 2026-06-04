import { Category, Habit } from '../models/index.js';
import { paginate } from '../services/pagination.js';
import { setETag, enforceIfMatch } from '../middleware/etag.js';
import { NotFound } from '../utils/errors.js';

async function findOwned(userId, categoryId) {
  const category = await Category.findOne({ where: { id: categoryId, userId } });
  if (!category) throw NotFound('Category not found.');
  return category;
}

async function habitCountFor(categoryId) {
  return Habit.count({ where: { categoryId } });
}

export async function listCategories(req, res, next) {
  try {
    const { limit, cursor } = req.query;
    const result = await paginate(
      Category,
      { where: { userId: req.user.id }, limit, cursor },
      (c) => c.toPublic()
    );
    // Enrich with habit counts.
    for (const item of result.data) {
      item.habitCount = await habitCountFor(item.id);
    }
    return res.status(200).json(result);
  } catch (err) {
    next(err);
  }
}

export async function createCategory(req, res, next) {
  try {
    const category = await Category.create({ ...req.body, userId: req.user.id });
    res.setHeader('Location', `/v1/categories/${category.id}`);
    setETag(res, category);
    return res.status(201).json(category.toPublic(0));
  } catch (err) {
    next(err);
  }
}

export async function getCategory(req, res, next) {
  try {
    const category = await findOwned(req.user.id, req.params.categoryId);
    setETag(res, category);
    return res.status(200).json(category.toPublic(await habitCountFor(category.id)));
  } catch (err) {
    next(err);
  }
}

export async function updateCategory(req, res, next) {
  try {
    const category = await findOwned(req.user.id, req.params.categoryId);
    enforceIfMatch(req, category);
    await category.update(req.body);
    setETag(res, category);
    return res.status(200).json(category.toPublic(await habitCountFor(category.id)));
  } catch (err) {
    next(err);
  }
}

export async function deleteCategory(req, res, next) {
  try {
    const category = await findOwned(req.user.id, req.params.categoryId);
    await category.destroy(); // habits' categoryId set to NULL via association
    return res.status(204).send();
  } catch (err) {
    next(err);
  }
}

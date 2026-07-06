const http = require("http");
const crypto = require("crypto");

const NS = "habit-tracker:";
const PORT = process.env.PORT || 3000;
const JSON_HEADERS = { "Content-Type": "application/json; charset=utf-8" };
const FORM_HEADERS = { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store", "Pragma": "no-cache" };

function nowIso() {
  return new Date().toISOString();
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function daysAgo(n) {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function id(prefix) {
  return `${prefix}_${crypto.randomBytes(6).toString("hex")}`;
}

function traceId() {
  return crypto.randomBytes(16).toString("hex");
}

function etag(entity) {
  return `W/\"${Buffer.from(`${entity.id || "entity"}:${entity.updatedAt || entity.createdAt || nowIso()}`).toString("base64url")}\"`;
}

function send(res, statusCode, body, headers = {}) {
  const finalHeaders = { ...JSON_HEADERS, ...headers };
  if (statusCode === 204) {
    res.writeHead(204, headers);
    res.end();
    return;
  }
  res.writeHead(statusCode, finalHeaders);
  res.end(JSON.stringify(body));
}

function sendError(res, statusCode, message, code) {
  send(res, statusCode, {
    error: {
      code: code || String(statusCode),
      message,
      traceId: traceId(),
    },
  });
}

async function readBody(req) {
  return new Promise((resolve, reject) => {
    let data = "";
    req.on("data", (chunk) => {
      data += chunk;
      if (data.length > 1024 * 1024) {
        reject(new Error("Request body too large."));
        req.destroy();
      }
    });
    req.on("end", () => {
      const contentType = String(req.headers["content-type"] || "").toLowerCase();
      if (!data) return resolve({});
      try {
        if (contentType.includes("application/x-www-form-urlencoded")) {
          return resolve(Object.fromEntries(new URLSearchParams(data)));
        }
        if (contentType.includes("application/json") || data.trim().startsWith("{") || data.trim().startsWith("[")) {
          return resolve(JSON.parse(data));
        }
        return resolve({ raw: data });
      } catch (err) {
        reject(new Error("Malformed request body."));
      }
    });
    req.on("error", reject);
  });
}

async function stateGet(key, fallback) {
  const value = await pm.state.get(NS + key);
  return value === undefined || value === null ? fallback : value;
}

async function stateSet(key, value) {
  await pm.state.set(NS + key, value);
}

async function getDb() {
  const seed = await stateGet("seeded", false);
  if (!seed) {
    const at = nowIso();
    const userId = "usr_demo";
    const categoryId = "cat_wellness";
    const habitId = "hab_hydration";
    const checkins = [
      { id: "chk_demo_1", habitId, date: daysAgo(2), status: "completed", value: 8, note: "Stayed on track", mood: "good", createdAt: at, updatedAt: at },
      { id: "chk_demo_2", habitId, date: daysAgo(1), status: "completed", value: 8, note: "Kept the streak alive", mood: "great", createdAt: at, updatedAt: at },
      { id: "chk_demo_3", habitId, date: todayIso(), status: "completed", value: 6, note: "In progress", mood: "focused", createdAt: at, updatedAt: at },
    ];
    await stateSet("users", [
      { id: userId, email: "demo@example.com", password: "password123", name: "Demo User", timezone: "UTC", locale: "en-US", createdAt: at, updatedAt: at },
    ]);
    await stateSet("tokens", { "mock_demo_access_token": userId });
    await stateSet("refreshTokens", { "mock_demo_refresh_token": userId });
    await stateSet("categories", [
      { id: categoryId, userId, name: "Wellness", description: "Health and wellness routines", color: "#22C55E", icon: "leaf", createdAt: at, updatedAt: at },
    ]);
    await stateSet("habits", [
      { id: habitId, userId, name: "Drink water", description: "Drink enough water every day", categoryId, color: "#38BDF8", icon: "droplet", frequency: "daily", targetDays: null, targetCount: 1, unit: "glasses", targetValue: 8, status: "active", startDate: daysAgo(14), endDate: null, createdAt: at, updatedAt: at },
    ]);
    await stateSet("checkins", checkins);
    await stateSet("reminders", [
      { id: "rem_demo_1", habitId, time: "09:00", daysOfWeek: [1, 2, 3, 4, 5], channel: "push", message: "Time to hydrate", isEnabled: true, createdAt: at, updatedAt: at },
    ]);
    await stateSet("seeded", true);
  }
  return {
    users: await stateGet("users", []),
    tokens: await stateGet("tokens", {}),
    refreshTokens: await stateGet("refreshTokens", {}),
    categories: await stateGet("categories", []),
    habits: await stateGet("habits", []),
    checkins: await stateGet("checkins", []),
    reminders: await stateGet("reminders", []),
  };
}

async function saveDb(db) {
  await stateSet("users", db.users);
  await stateSet("tokens", db.tokens);
  await stateSet("refreshTokens", db.refreshTokens);
  await stateSet("categories", db.categories);
  await stateSet("habits", db.habits);
  await stateSet("checkins", db.checkins);
  await stateSet("reminders", db.reminders);
}

function publicUser(user) {
  if (!user) return null;
  return { id: user.id, email: user.email, name: user.name, timezone: user.timezone || "UTC", locale: user.locale || "en-US", createdAt: user.createdAt, updatedAt: user.updatedAt };
}

function categoryPublic(category, db) {
  return {
    id: category.id,
    name: category.name,
    description: category.description ?? null,
    color: category.color ?? null,
    icon: category.icon ?? null,
    habitCount: db.habits.filter((h) => h.categoryId === category.id).length,
    createdAt: category.createdAt,
    updatedAt: category.updatedAt,
  };
}

function checkinPublic(checkin) {
  return {
    id: checkin.id,
    habitId: checkin.habitId,
    date: checkin.date,
    status: checkin.status || "completed",
    value: checkin.value ?? null,
    note: checkin.note ?? null,
    mood: checkin.mood ?? null,
    createdAt: checkin.createdAt,
    updatedAt: checkin.updatedAt,
  };
}

function reminderPublic(reminder) {
  return {
    id: reminder.id,
    habitId: reminder.habitId,
    time: reminder.time,
    daysOfWeek: reminder.daysOfWeek || [],
    channel: reminder.channel || "push",
    message: reminder.message ?? null,
    isEnabled: reminder.isEnabled !== false,
    createdAt: reminder.createdAt,
    updatedAt: reminder.updatedAt,
  };
}

function dateRange(start, end) {
  const dates = [];
  const s = new Date(`${start}T00:00:00Z`);
  const e = new Date(`${end}T00:00:00Z`);
  for (let d = s; d <= e; d = new Date(d.getTime() + 86400000)) dates.push(d.toISOString().slice(0, 10));
  return dates;
}

function computeStreaks(habit, db) {
  const completedDates = [...new Set(db.checkins.filter((c) => c.habitId === habit.id && c.status === "completed").map((c) => c.date))].sort();
  const streaks = [];
  let current = null;
  for (const date of completedDates) {
    if (!current) {
      current = { startDate: date, endDate: date, length: 1, isActive: false };
      continue;
    }
    const prev = new Date(`${current.endDate}T00:00:00Z`);
    const next = new Date(prev.getTime() + 86400000).toISOString().slice(0, 10);
    if (date === next) {
      current.endDate = date;
      current.length += 1;
    } else {
      streaks.push(current);
      current = { startDate: date, endDate: date, length: 1, isActive: false };
    }
  }
  if (current) streaks.push(current);
  const today = todayIso();
  const yesterday = daysAgo(1);
  for (const streak of streaks) streak.isActive = streak.endDate === today || streak.endDate === yesterday;
  const active = streaks.find((s) => s.isActive);
  return {
    streaks,
    currentStreak: active ? active.length : 0,
    longestStreak: streaks.reduce((max, s) => Math.max(max, s.length), 0),
  };
}

function completionRate(habit, db) {
  const end = habit.endDate || todayIso();
  const days = Math.max(1, dateRange(habit.startDate || todayIso(), end).length);
  const completed = db.checkins.filter((c) => c.habitId === habit.id && c.status === "completed" && c.date >= (habit.startDate || "0000-00-00") && c.date <= end).length;
  return Math.min(1, completed / days);
}

function habitPublic(habit, db) {
  const streak = computeStreaks(habit, db);
  return {
    id: habit.id,
    name: habit.name,
    description: habit.description ?? null,
    categoryId: habit.categoryId ?? null,
    color: habit.color ?? null,
    icon: habit.icon ?? null,
    frequency: habit.frequency || "daily",
    targetDays: habit.targetDays ?? null,
    targetCount: habit.targetCount ?? 1,
    unit: habit.unit ?? null,
    targetValue: habit.targetValue ?? null,
    status: habit.status || "active",
    startDate: habit.startDate || todayIso(),
    endDate: habit.endDate ?? null,
    currentStreak: streak.currentStreak,
    longestStreak: streak.longestStreak,
    completionRate: completionRate(habit, db),
    createdAt: habit.createdAt,
    updatedAt: habit.updatedAt,
  };
}

function paginate(items, searchParams) {
  const limit = Math.max(1, Math.min(100, Number(searchParams.get("limit") || 20)));
  const cursor = searchParams.get("cursor");
  const start = cursor ? Number(Buffer.from(cursor, "base64url").toString("utf8")) || 0 : 0;
  const page = items.slice(start, start + limit);
  const hasMore = start + limit < items.length;
  return {
    data: page,
    pagination: {
      totalCount: items.length,
      hasMore,
      nextCursor: hasMore ? Buffer.from(String(start + limit), "utf8").toString("base64url") : null,
      prevCursor: cursor || null,
    },
  };
}

function sortHabits(items, sort) {
  if (!sort) return items;
  const dir = sort.startsWith("-") ? -1 : 1;
  const field = sort.replace("-", "");
  return items.slice().sort((a, b) => {
    if (field === "name") return dir * String(a.name).localeCompare(String(b.name));
    if (field === "streak") return dir * ((a.currentStreak || 0) - (b.currentStreak || 0));
    if (field === "createdAt") return dir * String(a.createdAt).localeCompare(String(b.createdAt));
    return 0;
  });
}

function findCurrentUser(req, db) {
  const auth = String(req.headers.authorization || "");
  const match = auth.match(/^Bearer\s+(.+)$/i);
  if (!match) return null;
  const userId = db.tokens[match[1]];
  if (!userId || String(userId).startsWith("client:")) return null;
  return db.users.find((u) => u.id === userId) || null;
}

function tokenResponse(token, scope, refreshToken) {
  const body = { access_token: token, token_type: "Bearer", expires_in: 3600, scope: scope || "habits:read habits:write analytics:read" };
  if (refreshToken) body.refresh_token = refreshToken;
  return body;
}

function defaultDateParam(searchParams, key, fallback) {
  return searchParams.get(key) || fallback;
}

function bucketByGranularity(from, to, granularity, dates) {
  const points = [];
  const dateSet = new Set(dates);
  const end = new Date(`${to}T00:00:00Z`);
  let cursor = new Date(`${from}T00:00:00Z`);
  while (cursor <= end) {
    const periodStart = cursor.toISOString().slice(0, 10);
    let next;
    if (granularity === "monthly") next = new Date(Date.UTC(cursor.getUTCFullYear(), cursor.getUTCMonth() + 1, cursor.getUTCDate()));
    else if (granularity === "weekly") next = new Date(cursor.getTime() + 7 * 86400000);
    else next = new Date(cursor.getTime() + 86400000);
    let count = 0;
    let totalDays = 0;
    for (let d = new Date(cursor); d < next && d <= end; d = new Date(d.getTime() + 86400000)) {
      totalDays += 1;
      if (dateSet.has(d.toISOString().slice(0, 10))) count += 1;
    }
    points.push({ periodStart, completionRate: totalDays ? Math.min(1, count / totalDays) : 0, checkinsCount: count });
    cursor = next;
  }
  return points;
}

const server = http.createServer(async (req, res) => {
  try {
    const method = req.method;
    const parsed = new URL(req.url, `http://${req.headers.host || "localhost"}`);
    const url = parsed.pathname;
    const searchParams = parsed.searchParams;
    const db = await getDb();

    // @endpoint GET /health
    if (method === "GET" && url === "/health") {
      return send(res, 200, { status: "ok" });
    }

    // @endpoint POST /v1/auth/register
    if (method === "POST" && url === "/v1/auth/register") {
      const body = await readBody(req);
      if (!body.email || !body.password) return sendError(res, 400, "email and password are required.", "bad_request");
      if (db.users.some((u) => String(u.email).toLowerCase() === String(body.email).toLowerCase())) {
        return sendError(res, 409, "A user with this email already exists.", "conflict");
      }
      const at = nowIso();
      const user = { id: id("usr"), email: body.email, password: body.password, name: body.name || body.email.split("@")[0], timezone: body.timezone || "UTC", locale: body.locale || "en-US", createdAt: at, updatedAt: at };
      const access = `mock_access_${id("tok")}`;
      const refresh = `mock_refresh_${id("rft")}`;
      db.users.push(user);
      db.tokens[access] = user.id;
      db.refreshTokens[refresh] = user.id;
      await saveDb(db);
      return send(res, 201, { user: publicUser(user), ...tokenResponse(access, undefined, refresh) }, FORM_HEADERS);
    }

    // @endpoint POST /v1/auth/token
    if (method === "POST" && url === "/v1/auth/token") {
      const body = await readBody(req);
      if (body.grant_type === "password") {
        const user = db.users.find((u) => String(u.email).toLowerCase() === String(body.username).toLowerCase());
        if (!user || user.password !== body.password) return sendError(res, 401, "Invalid username or password.", "invalid_grant");
        const access = `mock_access_${id("tok")}`;
        const refresh = `mock_refresh_${id("rft")}`;
        db.tokens[access] = user.id;
        db.refreshTokens[refresh] = user.id;
        await saveDb(db);
        return send(res, 200, tokenResponse(access, undefined, refresh), FORM_HEADERS);
      }
      if (body.grant_type === "client_credentials") {
        if (!body.client_id || !body.client_secret) return sendError(res, 401, "Invalid client credentials.", "invalid_client");
        const access = `mock_client_${id("tok")}`;
        db.tokens[access] = `client:${body.client_id}`;
        await saveDb(db);
        return send(res, 200, tokenResponse(access, "analytics:read habits:read"), FORM_HEADERS);
      }
      return sendError(res, 400, "Unsupported grant_type.", "bad_request");
    }

    // @endpoint POST /v1/auth/token/refresh
    if (method === "POST" && url === "/v1/auth/token/refresh") {
      const body = await readBody(req);
      const userId = db.refreshTokens[body.refresh_token];
      if (!userId) return sendError(res, 401, "Refresh token is invalid, expired, or has been revoked.", "invalid_grant");
      delete db.refreshTokens[body.refresh_token];
      const access = `mock_access_${id("tok")}`;
      const refresh = `mock_refresh_${id("rft")}`;
      db.tokens[access] = userId;
      db.refreshTokens[refresh] = userId;
      await saveDb(db);
      return send(res, 200, tokenResponse(access, undefined, refresh), FORM_HEADERS);
    }

    // @endpoint POST /v1/auth/token/revoke
    if (method === "POST" && url === "/v1/auth/token/revoke") {
      const body = await readBody(req);
      if (body.refresh_token) delete db.refreshTokens[body.refresh_token];
      await saveDb(db);
      return send(res, 204, null);
    }

    if (url.startsWith("/v1/")) {
      const user = findCurrentUser(req, db);
      if (!user) return sendError(res, 401, "Missing or invalid bearer token.", "unauthorized");

      // @endpoint GET /v1/users/me
      if (method === "GET" && url === "/v1/users/me") {
        return send(res, 200, publicUser(user), { ETag: etag(user), "Last-Modified": new Date(user.updatedAt).toUTCString() });
      }

      // @endpoint PATCH /v1/users/me
      if (method === "PATCH" && url === "/v1/users/me") {
        const body = await readBody(req);
        Object.assign(user, { name: body.name ?? user.name, timezone: body.timezone ?? user.timezone, locale: body.locale ?? user.locale, updatedAt: nowIso() });
        await saveDb(db);
        return send(res, 200, publicUser(user), { ETag: etag(user) });
      }

      // @endpoint DELETE /v1/users/me
      if (method === "DELETE" && url === "/v1/users/me") {
        db.users = db.users.filter((u) => u.id !== user.id);
        db.categories = db.categories.filter((c) => c.userId !== user.id);
        const habitIds = db.habits.filter((h) => h.userId === user.id).map((h) => h.id);
        db.habits = db.habits.filter((h) => h.userId !== user.id);
        db.checkins = db.checkins.filter((c) => !habitIds.includes(c.habitId));
        db.reminders = db.reminders.filter((r) => !habitIds.includes(r.habitId));
        for (const token of Object.keys(db.tokens)) if (db.tokens[token] === user.id) delete db.tokens[token];
        await saveDb(db);
        return send(res, 204, null);
      }

      // @endpoint GET /v1/categories
      if (method === "GET" && url === "/v1/categories") {
        const owned = db.categories.filter((c) => c.userId === user.id).map((c) => categoryPublic(c, db));
        const page = paginate(owned, searchParams);
        return send(res, 200, page);
      }

      // @endpoint POST /v1/categories
      if (method === "POST" && url === "/v1/categories") {
        const body = await readBody(req);
        if (!body.name) return sendError(res, 400, "name is required.", "bad_request");
        const at = nowIso();
        const category = { id: id("cat"), userId: user.id, name: body.name, description: body.description ?? null, color: body.color ?? null, icon: body.icon ?? null, createdAt: at, updatedAt: at };
        db.categories.push(category);
        await saveDb(db);
        return send(res, 201, categoryPublic(category, db), { Location: `/v1/categories/${category.id}`, ETag: etag(category) });
      }

      const categoryMatch = url.match(/^\/v1\/categories\/([^/]+)$/);
      // @endpoint GET /v1/categories/:categoryId
      if (method === "GET" && categoryMatch) {
        const category = db.categories.find((c) => c.id === categoryMatch[1] && c.userId === user.id);
        if (!category) return sendError(res, 404, "Category not found.", "not_found");
        return send(res, 200, categoryPublic(category, db), { ETag: etag(category) });
      }

      // @endpoint PATCH /v1/categories/:categoryId
      if (method === "PATCH" && categoryMatch) {
        const category = db.categories.find((c) => c.id === categoryMatch[1] && c.userId === user.id);
        if (!category) return sendError(res, 404, "Category not found.", "not_found");
        const body = await readBody(req);
        Object.assign(category, { ...body, updatedAt: nowIso() });
        await saveDb(db);
        return send(res, 200, categoryPublic(category, db), { ETag: etag(category) });
      }

      // @endpoint DELETE /v1/categories/:categoryId
      if (method === "DELETE" && categoryMatch) {
        const idx = db.categories.findIndex((c) => c.id === categoryMatch[1] && c.userId === user.id);
        if (idx === -1) return sendError(res, 404, "Category not found.", "not_found");
        db.categories.splice(idx, 1);
        db.habits.forEach((h) => { if (h.categoryId === categoryMatch[1]) h.categoryId = null; });
        await saveDb(db);
        return send(res, 204, null);
      }

      // @endpoint GET /v1/habits
      if (method === "GET" && url === "/v1/habits") {
        let owned = db.habits.filter((h) => h.userId === user.id);
        if (searchParams.get("categoryId")) owned = owned.filter((h) => h.categoryId === searchParams.get("categoryId"));
        if (searchParams.get("status")) owned = owned.filter((h) => h.status === searchParams.get("status"));
        if (searchParams.get("frequency")) owned = owned.filter((h) => h.frequency === searchParams.get("frequency"));
        const shaped = sortHabits(owned.map((h) => habitPublic(h, db)), searchParams.get("sort"));
        return send(res, 200, paginate(shaped, searchParams));
      }

      // @endpoint POST /v1/habits
      if (method === "POST" && url === "/v1/habits") {
        const body = await readBody(req);
        if (!body.name) return sendError(res, 400, "name is required.", "bad_request");
        const at = nowIso();
        const habit = { id: id("hab"), userId: user.id, name: body.name, description: body.description ?? null, categoryId: body.categoryId ?? null, color: body.color ?? null, icon: body.icon ?? null, frequency: body.frequency || "daily", targetDays: body.targetDays ?? null, targetCount: body.targetCount ?? 1, unit: body.unit ?? null, targetValue: body.targetValue ?? null, status: body.status || "active", startDate: body.startDate || todayIso(), endDate: body.endDate ?? null, createdAt: at, updatedAt: at };
        db.habits.push(habit);
        await saveDb(db);
        return send(res, 201, habitPublic(habit, db), { Location: `/v1/habits/${habit.id}`, ETag: etag(habit) });
      }

      const habitMatch = url.match(/^\/v1\/habits\/([^/]+)$/);
      // @endpoint GET /v1/habits/:habitId
      if (method === "GET" && habitMatch) {
        const habit = db.habits.find((h) => h.id === habitMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        return send(res, 200, habitPublic(habit, db), { ETag: etag(habit), "Last-Modified": new Date(habit.updatedAt).toUTCString() });
      }

      // @endpoint PUT /v1/habits/:habitId
      if (method === "PUT" && habitMatch) {
        const habit = db.habits.find((h) => h.id === habitMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const body = await readBody(req);
        Object.assign(habit, { name: body.name, description: body.description ?? null, categoryId: body.categoryId ?? null, color: body.color ?? null, icon: body.icon ?? null, frequency: body.frequency || "daily", targetDays: body.targetDays ?? null, targetCount: body.targetCount ?? 1, unit: body.unit ?? null, targetValue: body.targetValue ?? null, status: body.status || habit.status || "active", startDate: body.startDate || habit.startDate || todayIso(), endDate: body.endDate ?? null, updatedAt: nowIso() });
        await saveDb(db);
        return send(res, 200, habitPublic(habit, db), { ETag: etag(habit) });
      }

      // @endpoint PATCH /v1/habits/:habitId
      if (method === "PATCH" && habitMatch) {
        const habit = db.habits.find((h) => h.id === habitMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const body = await readBody(req);
        Object.assign(habit, body, { updatedAt: nowIso() });
        await saveDb(db);
        return send(res, 200, habitPublic(habit, db), { ETag: etag(habit) });
      }

      // @endpoint DELETE /v1/habits/:habitId
      if (method === "DELETE" && habitMatch) {
        const idx = db.habits.findIndex((h) => h.id === habitMatch[1] && h.userId === user.id);
        if (idx === -1) return sendError(res, 404, "Habit not found.", "not_found");
        const habitId = db.habits[idx].id;
        db.habits.splice(idx, 1);
        db.checkins = db.checkins.filter((c) => c.habitId !== habitId);
        db.reminders = db.reminders.filter((r) => r.habitId !== habitId);
        await saveDb(db);
        return send(res, 204, null);
      }

      const checkinsMatch = url.match(/^\/v1\/habits\/([^/]+)\/checkins$/);
      // @endpoint GET /v1/habits/:habitId/checkins
      if (method === "GET" && checkinsMatch) {
        const habit = db.habits.find((h) => h.id === checkinsMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        let items = db.checkins.filter((c) => c.habitId === habit.id);
        if (searchParams.get("from")) items = items.filter((c) => c.date >= searchParams.get("from"));
        if (searchParams.get("to")) items = items.filter((c) => c.date <= searchParams.get("to"));
        if (searchParams.get("status")) items = items.filter((c) => c.status === searchParams.get("status"));
        items.sort((a, b) => a.date.localeCompare(b.date));
        return send(res, 200, paginate(items.map(checkinPublic), searchParams));
      }

      // @endpoint POST /v1/habits/:habitId/checkins
      if (method === "POST" && checkinsMatch) {
        const habit = db.habits.find((h) => h.id === checkinsMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const body = await readBody(req);
        const date = body.date || todayIso();
        if (db.checkins.some((c) => c.habitId === habit.id && c.date === date)) return sendError(res, 409, "A check-in already exists for this habit on this date.", "conflict");
        const at = nowIso();
        const checkin = { id: id("chk"), habitId: habit.id, date, status: body.status || "completed", value: body.value ?? null, note: body.note ?? null, mood: body.mood ?? null, createdAt: at, updatedAt: at };
        db.checkins.push(checkin);
        await saveDb(db);
        return send(res, 201, checkinPublic(checkin), { Location: `/v1/habits/${habit.id}/checkins/${checkin.id}`, ETag: etag(checkin) });
      }

      const checkinMatch = url.match(/^\/v1\/habits\/([^/]+)\/checkins\/([^/]+)$/);
      // @endpoint GET /v1/habits/:habitId/checkins/:checkinId
      if (method === "GET" && checkinMatch) {
        const habit = db.habits.find((h) => h.id === checkinMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const checkin = db.checkins.find((c) => c.habitId === habit.id && c.id === checkinMatch[2]);
        if (!checkin) return sendError(res, 404, "Check-in not found.", "not_found");
        return send(res, 200, checkinPublic(checkin), { ETag: etag(checkin) });
      }

      // @endpoint PATCH /v1/habits/:habitId/checkins/:checkinId
      if (method === "PATCH" && checkinMatch) {
        const habit = db.habits.find((h) => h.id === checkinMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const checkin = db.checkins.find((c) => c.habitId === habit.id && c.id === checkinMatch[2]);
        if (!checkin) return sendError(res, 404, "Check-in not found.", "not_found");
        const body = await readBody(req);
        if (body.date && body.date !== checkin.date && db.checkins.some((c) => c.habitId === habit.id && c.date === body.date)) return sendError(res, 409, "A check-in already exists for this habit on this date.", "conflict");
        Object.assign(checkin, body, { updatedAt: nowIso() });
        await saveDb(db);
        return send(res, 200, checkinPublic(checkin), { ETag: etag(checkin) });
      }

      // @endpoint DELETE /v1/habits/:habitId/checkins/:checkinId
      if (method === "DELETE" && checkinMatch) {
        const habit = db.habits.find((h) => h.id === checkinMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const idx = db.checkins.findIndex((c) => c.habitId === habit.id && c.id === checkinMatch[2]);
        if (idx === -1) return sendError(res, 404, "Check-in not found.", "not_found");
        db.checkins.splice(idx, 1);
        await saveDb(db);
        return send(res, 204, null);
      }

      const streaksMatch = url.match(/^\/v1\/habits\/([^/]+)\/streaks$/);
      // @endpoint GET /v1/habits/:habitId/streaks
      if (method === "GET" && streaksMatch) {
        const habit = db.habits.find((h) => h.id === streaksMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const computed = computeStreaks(habit, db).streaks.slice().reverse().map((s, i) => ({ id: `${habit.id}-${i}`, habitId: habit.id, ...s }));
        return send(res, 200, paginate(computed, searchParams));
      }

      const currentStreakMatch = url.match(/^\/v1\/habits\/([^/]+)\/streaks\/current$/);
      // @endpoint GET /v1/habits/:habitId/streaks/current
      if (method === "GET" && currentStreakMatch) {
        const habit = db.habits.find((h) => h.id === currentStreakMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const computed = computeStreaks(habit, db);
        const active = computed.streaks.find((s) => s.isActive);
        return send(res, 200, active ? { id: `${habit.id}-current`, habitId: habit.id, startDate: active.startDate, endDate: null, length: computed.currentStreak, isActive: true } : { id: `${habit.id}-current`, habitId: habit.id, startDate: todayIso(), endDate: null, length: 0, isActive: false });
      }

      const remindersMatch = url.match(/^\/v1\/habits\/([^/]+)\/reminders$/);
      // @endpoint GET /v1/habits/:habitId/reminders
      if (method === "GET" && remindersMatch) {
        const habit = db.habits.find((h) => h.id === remindersMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const reminders = db.reminders.filter((r) => r.habitId === habit.id).sort((a, b) => a.time.localeCompare(b.time)).map(reminderPublic);
        return send(res, 200, reminders);
      }

      // @endpoint POST /v1/habits/:habitId/reminders
      if (method === "POST" && remindersMatch) {
        const habit = db.habits.find((h) => h.id === remindersMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const body = await readBody(req);
        const at = nowIso();
        const reminder = { id: id("rem"), habitId: habit.id, time: body.time || "09:00", daysOfWeek: body.daysOfWeek || [1, 2, 3, 4, 5], channel: body.channel || "push", message: body.message ?? null, isEnabled: body.isEnabled !== false, createdAt: at, updatedAt: at };
        db.reminders.push(reminder);
        await saveDb(db);
        return send(res, 201, reminderPublic(reminder), { Location: `/v1/habits/${habit.id}/reminders/${reminder.id}` });
      }

      const reminderMatch = url.match(/^\/v1\/habits\/([^/]+)\/reminders\/([^/]+)$/);
      // @endpoint GET /v1/habits/:habitId/reminders/:reminderId
      if (method === "GET" && reminderMatch) {
        const habit = db.habits.find((h) => h.id === reminderMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const reminder = db.reminders.find((r) => r.habitId === habit.id && r.id === reminderMatch[2]);
        if (!reminder) return sendError(res, 404, "Reminder not found.", "not_found");
        return send(res, 200, reminderPublic(reminder));
      }

      // @endpoint PATCH /v1/habits/:habitId/reminders/:reminderId
      if (method === "PATCH" && reminderMatch) {
        const habit = db.habits.find((h) => h.id === reminderMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const reminder = db.reminders.find((r) => r.habitId === habit.id && r.id === reminderMatch[2]);
        if (!reminder) return sendError(res, 404, "Reminder not found.", "not_found");
        const body = await readBody(req);
        Object.assign(reminder, body, { updatedAt: nowIso() });
        await saveDb(db);
        return send(res, 200, reminderPublic(reminder));
      }

      // @endpoint DELETE /v1/habits/:habitId/reminders/:reminderId
      if (method === "DELETE" && reminderMatch) {
        const habit = db.habits.find((h) => h.id === reminderMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const idx = db.reminders.findIndex((r) => r.habitId === habit.id && r.id === reminderMatch[2]);
        if (idx === -1) return sendError(res, 404, "Reminder not found.", "not_found");
        db.reminders.splice(idx, 1);
        await saveDb(db);
        return send(res, 204, null);
      }

      // @endpoint GET /v1/analytics/summary
      if (method === "GET" && url === "/v1/analytics/summary") {
        const from = defaultDateParam(searchParams, "from", daysAgo(30));
        const to = defaultDateParam(searchParams, "to", todayIso());
        const habits = db.habits.filter((h) => h.userId === user.id);
        const habitIds = new Set(habits.map((h) => h.id));
        const totalCheckins = db.checkins.filter((c) => habitIds.has(c.habitId) && c.status === "completed" && c.date >= from && c.date <= to).length;
        const periodDays = Math.max(1, dateRange(from, to).length);
        const expected = habits.length * periodDays;
        const perHabit = habits.map((h) => {
          const count = db.checkins.filter((c) => c.habitId === h.id && c.status === "completed" && c.date >= from && c.date <= to).length;
          return { habitId: h.id, habitName: h.name, completionRate: periodDays ? Math.min(1, count / periodDays) : 0, checkinsCount: count };
        }).sort((a, b) => b.completionRate - a.completionRate);
        const streaks = habits.map((h) => computeStreaks(h, db));
        return send(res, 200, { periodStart: from, periodEnd: to, totalHabits: habits.length, activeHabits: habits.filter((h) => h.status === "active").length, totalCheckins, completionRate: expected ? Math.min(1, totalCheckins / expected) : 0, longestStreak: streaks.reduce((m, s) => Math.max(m, s.longestStreak), 0), currentStreak: streaks.reduce((m, s) => Math.max(m, s.currentStreak), 0), topHabits: perHabit.slice(0, 5) });
      }

      const trendsMatch = url.match(/^\/v1\/analytics\/habits\/([^/]+)\/trends$/);
      // @endpoint GET /v1/analytics/habits/:habitId/trends
      if (method === "GET" && trendsMatch) {
        const habit = db.habits.find((h) => h.id === trendsMatch[1] && h.userId === user.id);
        if (!habit) return sendError(res, 404, "Habit not found.", "not_found");
        const from = defaultDateParam(searchParams, "from", daysAgo(30));
        const to = defaultDateParam(searchParams, "to", todayIso());
        const granularity = searchParams.get("granularity") || "daily";
        const dates = db.checkins.filter((c) => c.habitId === habit.id && c.status === "completed" && c.date >= from && c.date <= to).map((c) => c.date);
        return send(res, 200, { habitId: habit.id, granularity, dataPoints: bucketByGranularity(from, to, granularity, dates) });
      }
    }

    return sendError(res, 404, "Route not found.", "not_found");
  } catch (err) {
    return sendError(res, err.message === "Malformed request body." ? 400 : 500, err.message || "Unexpected mock server error.", err.message === "Malformed request body." ? "bad_request" : "internal_error");
  }
});

server.listen(PORT, () => {
  console.log(`Habit Tracker Digital Twin listening on port ${PORT}`);
});

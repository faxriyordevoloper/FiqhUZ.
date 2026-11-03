import express from 'express'
import cors from 'cors'
import jwt from 'jsonwebtoken'
import bcrypt from 'bcryptjs'
import sqlite3 from 'sqlite3'
import { createHash, randomBytes, randomUUID } from 'node:crypto'
import { fileURLToPath } from 'url'
import path from 'path'
import { runMigrations } from './migrations/index.js'

const app = express()
const PORT = process.env.PORT || 4000
const JWT_SECRET = process.env.JWT_SECRET || 'huquqiy-dev-secret'

const __filename = fileURLToPath(import.meta.url)
const __dirname = path.dirname(__filename)

app.use(cors())
app.use(express.json())
app.use(express.urlencoded({ extended: true }))

let db

const run = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.run(query, params, function (err) {
      if (err) reject(err)
      else resolve({ id: this.lastID, changes: this.changes })
    })
  })

const get = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.get(query, params, (err, row) => {
      if (err) reject(err)
      else resolve(row)
    })
  })

const all = (query, params = []) =>
  new Promise((resolve, reject) => {
    db.all(query, params, (err, rows) => {
      if (err) reject(err)
      else resolve(rows)
    })
  })

const initializeDb = async () => {
  await run(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      role TEXT DEFAULT 'foydalanuvchi',
      created_at TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS chats (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      question TEXT,
      answer TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS documents (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      type TEXT NOT NULL,
      status TEXT DEFAULT 'Yaratildi',
      content TEXT,
      created_at TEXT DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id)
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS legal_documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      lex_title TEXT NOT NULL,
      lex_document_id TEXT NOT NULL,
      type TEXT NOT NULL,
      area TEXT NOT NULL,
      source_url TEXT NOT NULL,
      source_checked_at TEXT NOT NULL
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS legal_articles (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      law_id TEXT NOT NULL,
      article_number TEXT NOT NULL,
      title TEXT NOT NULL,
      text TEXT NOT NULL,
      section_title TEXT NOT NULL DEFAULT '',
      chapter_title TEXT NOT NULL DEFAULT '',
      source_url TEXT NOT NULL,
      source_anchor TEXT,
      updated_at TEXT NOT NULL,
      FOREIGN KEY(law_id) REFERENCES legal_documents(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS saved_articles (
      user_id INTEGER NOT NULL,
      article_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, article_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(article_id) REFERENCES legal_articles(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS legal_search_history (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      query TEXT NOT NULL,
      area TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_courses (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      slug TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      subject TEXT NOT NULL DEFAULT 'Huquq',
      level TEXT NOT NULL DEFAULT 'Boshlang‘ich',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_lessons (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      content TEXT NOT NULL DEFAULT '',
      video_url TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_course_questions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      course_id INTEGER NOT NULL,
      question TEXT NOT NULL,
      option_a TEXT NOT NULL,
      option_b TEXT NOT NULL,
      option_c TEXT NOT NULL,
      correct_option TEXT NOT NULL CHECK(correct_option IN ('a', 'b', 'c')),
      explanation TEXT NOT NULL DEFAULT '',
      position INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_course_assessments (
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      score INTEGER NOT NULL,
      total INTEGER NOT NULL,
      passed INTEGER NOT NULL DEFAULT 0,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, course_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_enrollments (
      user_id INTEGER NOT NULL,
      course_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      completed_at TEXT,
      certificate_code TEXT,
      PRIMARY KEY(user_id, course_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(course_id) REFERENCES academy_courses(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_lesson_progress (
      user_id INTEGER NOT NULL,
      lesson_id INTEGER NOT NULL,
      completed_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, lesson_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(lesson_id) REFERENCES academy_lessons(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_comments (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(post_id) REFERENCES academy_posts(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_likes (
      post_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(post_id, user_id),
      FOREIGN KEY(post_id) REFERENCES academy_posts(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_follows (
      follower_id INTEGER NOT NULL,
      following_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(follower_id, following_id),
      CHECK(follower_id != following_id),
      FOREIGN KEY(follower_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(following_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_messages (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      sender_id INTEGER NOT NULL,
      recipient_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      read_at TEXT,
      FOREIGN KEY(sender_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(recipient_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_channels (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      owner_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(owner_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_channel_subscriptions (
      channel_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(channel_id, user_id),
      FOREIGN KEY(channel_id) REFERENCES academy_channels(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_channel_posts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      channel_id INTEGER NOT NULL,
      author_id INTEGER NOT NULL,
      body TEXT NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(channel_id) REFERENCES academy_channels(id) ON DELETE CASCADE,
      FOREIGN KEY(author_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_groups (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      category TEXT NOT NULL DEFAULT 'Qiziqish',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_group_members (
      group_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(group_id, user_id),
      FOREIGN KEY(group_id) REFERENCES academy_groups(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_projects (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      url TEXT NOT NULL DEFAULT '',
      type TEXT NOT NULL DEFAULT 'Loyiha',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_events (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      event_at TEXT NOT NULL,
      location TEXT NOT NULL DEFAULT 'Onlayn',
      created_by INTEGER,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(created_by) REFERENCES users(id) ON DELETE SET NULL
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_event_attendees (
      event_id INTEGER NOT NULL,
      user_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(event_id, user_id),
      FOREIGN KEY(event_id) REFERENCES academy_events(id) ON DELETE CASCADE,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_notifications (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER NOT NULL,
      actor_id INTEGER,
      kind TEXT NOT NULL,
      message TEXT NOT NULL,
      entity_id INTEGER,
      read_at TEXT,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(actor_id) REFERENCES users(id) ON DELETE SET NULL
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_points (
      user_id INTEGER PRIMARY KEY,
      xp INTEGER NOT NULL DEFAULT 0,
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_achievements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      code TEXT UNIQUE NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL,
      xp_required INTEGER NOT NULL
    )
  `)

  await run(`
    CREATE TABLE IF NOT EXISTS academy_user_achievements (
      user_id INTEGER NOT NULL,
      achievement_id INTEGER NOT NULL,
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      PRIMARY KEY(user_id, achievement_id),
      FOREIGN KEY(user_id) REFERENCES users(id) ON DELETE CASCADE,
      FOREIGN KEY(achievement_id) REFERENCES academy_achievements(id) ON DELETE CASCADE
    )
  `)

  await run(`
    CREATE INDEX IF NOT EXISTS idx_legal_articles_law_number
    ON legal_articles(law_id, article_number)
  `)

  await run(`
    CREATE INDEX IF NOT EXISTS idx_legal_search_history_user
    ON legal_search_history(user_id, created_at DESC)
  `)

  await run('CREATE INDEX IF NOT EXISTS idx_academy_posts_created ON academy_posts(created_at DESC)')
  await run('CREATE INDEX IF NOT EXISTS idx_academy_messages_pair ON academy_messages(sender_id, recipient_id, created_at)')
  await run('CREATE INDEX IF NOT EXISTS idx_academy_notifications_user ON academy_notifications(user_id, created_at DESC)')

  await run(
    `INSERT OR IGNORE INTO academy_courses (slug, title, description, subject, level)
     VALUES (?, ?, ?, ?, ?)`,
    ['huquqiy-savodxonlik', 'Huquqiy savodxonlik asoslari', 'Huquqiy hujjatni o‘qish, rasmiy manbani topish va huquqiy savolni tartibli tahlil qilish bo‘yicha kirish kursi.', 'Huquqiy savodxonlik', 'Boshlang‘ich'],
  )
  const starterCourse = await get('SELECT id FROM academy_courses WHERE slug = ?', ['huquqiy-savodxonlik'])
  const starterLessons = [
    ['Rasmiy huquqiy manbadan foydalanish', 'LexUZ’dagi hujjatning nomi, holati, tahrir sanasi va manba havolasini tekshiring. O‘quv mashqi: bir hujjatni tanlab, uning nomi va amaldagi holatini qayd eting.', '', 1],
    ['Huquqiy matnni tahlil qilish', 'Matndagi qoida, shart, huquq va majburiyatlarni alohida ajrating. Faktlarni normaning shartlari bilan solishtiring; noaniq joylarni savol sifatida belgilang.', '', 2],
    ['Dalil va murojaatni tartiblash', 'Vaziyat sanalari, ishtirokchilar va hujjatlarni ketma-ket yozib chiqing. Rasmiy murojaatda faktlar, aniq talab va ilovalar ro‘yxatini alohida ko‘rsating.', '', 3],
  ]
  for (const [title, content, videoUrl, position] of starterLessons) {
    await run(
      'INSERT OR IGNORE INTO academy_lessons (course_id, title, content, video_url, position) SELECT ?, ?, ?, ?, ? WHERE NOT EXISTS (SELECT 1 FROM academy_lessons WHERE course_id = ? AND position = ?)',
      [starterCourse.id, title, content, videoUrl, position, starterCourse.id, position],
    )
  }
  const starterQuestions = [
    ['Hujjatning amaldagi holatini qayerdan tekshirish kerak?', 'Rasmiy huquqiy manbadan', 'Faqat ijtimoiy tarmoqdan', 'Eski konspektdan', 'a', 'Rasmiy manbaning hujjat holati va tahrir ma’lumotlarini tekshiring.', 1],
    ['Huquqiy qoida qo‘llanishini tahlil qilganda nimani solishtirish kerak?', 'Faqat fikrlarni', 'Norma shartlari va vaziyat faktlarini', 'Faqat hujjat nomini', 'b', 'Vaziyat faktlarini normada ko‘rsatilgan shartlarga solishtiring.', 2],
    ['Rasmiy murojaatda qaysi qismlar aniq ko‘rsatiladi?', 'Faktlar, talab va ilovalar', 'Faqat hissiyot', 'Faqat sarlavha', 'a', 'Murojaat faktlar, aniq talab va tasdiqlovchi ilovalardan tuziladi.', 3],
  ]
  for (const [question, optionA, optionB, optionC, correctOption, explanation, position] of starterQuestions) {
    await run(
      `INSERT OR IGNORE INTO academy_course_questions
       (course_id, question, option_a, option_b, option_c, correct_option, explanation, position)
       SELECT ?, ?, ?, ?, ?, ?, ?, ? WHERE NOT EXISTS (
         SELECT 1 FROM academy_course_questions WHERE course_id = ? AND position = ?
       )`,
      [starterCourse.id, question, optionA, optionB, optionC, correctOption, explanation, position, starterCourse.id, position],
    )
  }
  const achievements = [
    ['first_step', 'Birinchi qadam', 'Akademiyadagi ilk faoliyat ballari olindi.', 10],
    ['active_learner', 'Faol o‘rganuvchi', '50 XP to‘plandi.', 50],
    ['academy_star', 'Akademiya yulduzi', '200 XP to‘plandi.', 200],
  ]
  for (const achievement of achievements) {
    await run(
      'INSERT OR IGNORE INTO academy_achievements (code, title, description, xp_required) VALUES (?, ?, ?, ?)',
      achievement,
    )
  }
}

const authMiddleware = (req, res, next) => {
  const authHeader = req.headers.authorization

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Token mavjud emas' })
  }

  const token = authHeader.replace('Bearer ', '')

  try {
    const payload = jwt.verify(token, JWT_SECRET)
    req.user = payload
    next()
  } catch {
    return res.status(401).json({ message: 'Noto‘g‘ri yoki muddati o‘tgan token' })
  }
}

const academyAdminMiddleware = async (req, res, next) => {
  try {
    const user = await get('SELECT role FROM users WHERE id = ?', [req.user.id])
    if (!user || user.role !== 'admin') {
      return res.status(403).json({ message: 'Bu amal administrator huquqini talab qiladi.' })
    }
    return next()
  } catch (error) {
    console.error('Academy admin authorization failed:', error)
    return res.status(500).json({ message: 'Administrator huquqini tekshirib bo‘lmadi.' })
  }
}

const academyText = (value, maxLength) => String(value || '').trim().slice(0, maxLength)
const academyId = (value) => {
  const parsed = Number.parseInt(value, 10)
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null
}

const validChannelTypes = new Set(['public', 'private', 'educational', 'announcement', 'discussion'])
const channelRoles = [
  ['owner', 'Egasi', ['manage_channel', 'manage_roles', 'manage_members', 'manage_invites', 'publish_posts', 'moderate_posts', 'view_analytics']],
  ['admin', 'Administrator', ['manage_channel', 'manage_roles', 'manage_members', 'manage_invites', 'publish_posts', 'moderate_posts', 'view_analytics']],
  ['editor', 'Muharrir', ['publish_posts', 'edit_own_posts']],
  ['moderator', 'Moderator', ['moderate_posts', 'manage_members']],
  ['analytics', 'Tahlilchi', ['view_analytics']],
  ['subscriber', 'Obunachi', ['comment_posts', 'react_posts']],
]
const channelTokenHash = (token) => createHash('sha256').update(token).digest('hex')

const createChannelRoles = async (channelId, ownerId) => {
  for (const [position, [code, name, permissions]] of channelRoles.entries()) {
    await run(
      `INSERT INTO academy_channel_roles
       (channel_id, code, name, permissions_json, position, is_builtin)
       VALUES (?, ?, ?, ?, ?, 1)`,
      [channelId, code, name, JSON.stringify(permissions), position],
    )
  }
  const ownerRole = await get(
    'SELECT id FROM academy_channel_roles WHERE channel_id = ? AND code = ?',
    [channelId, 'owner'],
  )
  await run(
    'INSERT INTO academy_channel_members (channel_id, user_id, role_id) VALUES (?, ?, ?)',
    [channelId, ownerId, ownerRole.id],
  )
}

const getChannelAccess = async (channelId, userId) => get(
  `SELECT c.id, c.owner_id, c.title, s.channel_type, s.visibility, s.category, s.archived_at,
          r.id AS role_id, r.code AS role_code, r.permissions_json
   FROM academy_channels c
   JOIN academy_channel_settings s ON s.channel_id = c.id
   LEFT JOIN academy_channel_members m
     ON m.channel_id = c.id AND m.user_id = ? AND m.status = 'active'
   LEFT JOIN academy_channel_roles r ON r.id = m.role_id
   WHERE c.id = ?`,
  [userId, channelId],
)

const hasChannelPermission = (access, permission) => {
  if (!access) return false
  if (access.owner_id === access.user_id || access.role_code === 'owner') return true
  if (permission === 'read_channel') return canReadChannel(access)
  try {
    return JSON.parse(access.permissions_json || '[]').includes(permission)
  } catch (error) {
    console.error('Invalid channel role permissions JSON:', error)
    return false
  }
}

const canReadChannel = (access) =>
  Boolean(access && (access.role_id || (access.visibility === 'public' && !access.archived_at)))

const channelPermissionError = (res, access, userId, permission) => {
  if (!access) {
    res.status(404).json({ message: 'Kanal topilmadi.' })
    return true
  }
  if (!canReadChannel(access)) {
    res.status(404).json({ message: 'Kanal topilmadi yoki sizga ko‘rinmaydi.' })
    return true
  }
  if (!hasChannelPermission({ ...access, user_id: userId }, permission)) {
    res.status(403).json({ message: 'Bu amal uchun kanal ruxsati yetarli emas.' })
    return true
  }
  return false
}

const addAcademyNotification = async (userId, actorId, kind, message, entityId = null) => {
  if (!userId || userId === actorId) return
  await run(
    'INSERT INTO academy_notifications (user_id, actor_id, kind, message, entity_id) VALUES (?, ?, ?, ?, ?)',
    [userId, actorId || null, kind, message, entityId],
  )
}

const awardAcademyXp = async (userId, amount) => {
  await run('INSERT OR IGNORE INTO academy_points (user_id, xp) VALUES (?, 0)', [userId])
  await run('UPDATE academy_points SET xp = xp + ? WHERE user_id = ?', [amount, userId])
  const points = await get('SELECT xp FROM academy_points WHERE user_id = ?', [userId])
  const earned = await all(
    `SELECT a.id, a.title, a.description
     FROM academy_achievements a
     WHERE a.xp_required <= ? AND NOT EXISTS (
       SELECT 1 FROM academy_user_achievements ua
       WHERE ua.achievement_id = a.id AND ua.user_id = ?
     )`,
    [points.xp, userId],
  )
  for (const achievement of earned) {
    await run(
      'INSERT OR IGNORE INTO academy_user_achievements (user_id, achievement_id) VALUES (?, ?)',
      [userId, achievement.id],
    )
    await addAcademyNotification(userId, null, 'achievement', `Yangi yutuq: ${achievement.title}`, achievement.id)
  }
  return points.xp
}

const issueAcademyCertificate = async (userId, courseId) => {
  const progress = await get(
    `SELECT
       (SELECT COUNT(*) FROM academy_lessons WHERE course_id = ?) AS total_lessons,
       (SELECT COUNT(*) FROM academy_lesson_progress lp JOIN academy_lessons l ON l.id = lp.lesson_id
        WHERE lp.user_id = ? AND l.course_id = ?) AS completed_lessons,
       (SELECT COUNT(*) FROM academy_course_questions WHERE course_id = ?) AS total_questions,
       (SELECT passed FROM academy_course_assessments WHERE user_id = ? AND course_id = ?) AS passed,
       (SELECT certificate_code FROM academy_enrollments WHERE user_id = ? AND course_id = ?) AS certificate_code`,
    [courseId, userId, courseId, courseId, userId, courseId, userId, courseId],
  )
  if (
    !progress.total_lessons ||
    progress.completed_lessons !== progress.total_lessons ||
    !progress.total_questions ||
    !progress.passed
  ) return null

  await run(
    `UPDATE academy_enrollments
     SET completed_at = COALESCE(completed_at, CURRENT_TIMESTAMP),
         certificate_code = COALESCE(certificate_code, ?)
     WHERE user_id = ? AND course_id = ?`,
    [randomUUID(), userId, courseId],
  )
  const certificate = await get(
    'SELECT certificate_code, completed_at FROM academy_enrollments WHERE user_id = ? AND course_id = ?',
    [userId, courseId],
  )
  if (certificate && !progress.certificate_code) await awardAcademyXp(userId, 30)
  return certificate
}

const getAcademyPosts = async (userId) => {
  const posts = await all(
    `SELECT p.id, p.user_id, u.name AS author_name, p.body, p.created_at,
            COUNT(DISTINCT l.user_id) AS like_count,
            COUNT(DISTINCT c.id) AS comment_count,
            EXISTS(SELECT 1 FROM academy_likes ml WHERE ml.post_id = p.id AND ml.user_id = ?) AS liked_by_me,
            EXISTS(SELECT 1 FROM academy_follows f WHERE f.following_id = p.user_id AND f.follower_id = ?) AS followed_by_me
     FROM academy_posts p
     JOIN users u ON u.id = p.user_id
     LEFT JOIN academy_likes l ON l.post_id = p.id
     LEFT JOIN academy_comments c ON c.post_id = p.id
     GROUP BY p.id
     ORDER BY p.created_at DESC LIMIT 50`,
    [userId, userId],
  )
  if (!posts.length) return posts
  const ids = posts.map((post) => post.id)
  const comments = await all(
    `SELECT c.id, c.post_id, c.user_id, u.name AS author_name, c.body, c.created_at
     FROM academy_comments c JOIN users u ON u.id = c.user_id
     WHERE c.post_id IN (${ids.map(() => '?').join(',')})
     ORDER BY c.created_at`,
    ids,
  )
  const commentsByPost = new Map()
  for (const comment of comments) {
    const postComments = commentsByPost.get(comment.post_id) || []
    postComments.push(comment)
    commentsByPost.set(comment.post_id, postComments)
  }
  return posts.map((post) => ({ ...post, comments: commentsByPost.get(post.id) || [] }))
}

app.get('/api/academy/overview', authMiddleware, async (req, res) => {
  const userId = req.user.id
  const [user, courses, posts, channels, groups, projects, events, notifications, leaderboard, achievements, stats] =
    await Promise.all([
      get('SELECT id, name, email, role FROM users WHERE id = ?', [userId]),
      all(
        `SELECT c.id, c.slug, c.title, c.description, c.subject, c.level,
                COUNT(DISTINCT l.id) AS lesson_count,
                COUNT(DISTINCT lp.lesson_id) AS completed_lessons,
                MAX(CASE WHEN e.user_id IS NOT NULL THEN 1 ELSE 0 END) AS enrolled,
                MAX(e.certificate_code) AS certificate_code
         FROM academy_courses c
         LEFT JOIN academy_lessons l ON l.course_id = c.id
         LEFT JOIN academy_enrollments e ON e.course_id = c.id AND e.user_id = ?
         LEFT JOIN academy_lesson_progress lp ON lp.lesson_id = l.id AND lp.user_id = ?
         GROUP BY c.id ORDER BY c.created_at DESC`,
        [userId, userId],
      ),
      getAcademyPosts(userId),
      all(
        `SELECT c.id, c.owner_id, c.title, c.description, u.name AS owner_name,
                COUNT(DISTINCT s.user_id) AS subscriber_count,
                (SELECT COUNT(*) FROM academy_channel_posts cp WHERE cp.channel_id = c.id) AS post_count,
                EXISTS(SELECT 1 FROM academy_channel_members mine WHERE mine.channel_id = c.id AND mine.user_id = ? AND mine.status = 'active') AS subscribed_by_me,
                cs.channel_type, cs.visibility, cs.category
         FROM academy_channels c JOIN users u ON u.id = c.owner_id
         JOIN academy_channel_settings cs ON cs.channel_id = c.id
         LEFT JOIN academy_channel_subscriptions s ON s.channel_id = c.id
         WHERE cs.archived_at IS NULL
           AND (cs.visibility = 'public' OR EXISTS(
             SELECT 1 FROM academy_channel_members mine
             WHERE mine.channel_id = c.id AND mine.user_id = ? AND mine.status = 'active'
           ))
         GROUP BY c.id ORDER BY subscriber_count DESC, c.created_at DESC LIMIT 30`,
        [userId, userId],
      ),
      all(
        `SELECT g.id, g.title, g.description, g.category,
                COUNT(DISTINCT m.user_id) AS member_count,
                EXISTS(SELECT 1 FROM academy_group_members mine WHERE mine.group_id = g.id AND mine.user_id = ?) AS joined_by_me
         FROM academy_groups g LEFT JOIN academy_group_members m ON m.group_id = g.id
         GROUP BY g.id ORDER BY g.created_at DESC LIMIT 40`,
        [userId],
      ),
      all(
        `SELECT p.id, p.user_id, u.name AS author_name, p.title, p.description, p.url, p.type, p.created_at
         FROM academy_projects p JOIN users u ON u.id = p.user_id
         ORDER BY p.created_at DESC LIMIT 40`,
      ),
      all(
        `SELECT e.id, e.title, e.description, e.event_at, e.location,
                COUNT(DISTINCT a.user_id) AS attendee_count,
                EXISTS(SELECT 1 FROM academy_event_attendees mine WHERE mine.event_id = e.id AND mine.user_id = ?) AS attending
         FROM academy_events e LEFT JOIN academy_event_attendees a ON a.event_id = e.id
         GROUP BY e.id ORDER BY e.event_at LIMIT 30`,
        [userId],
      ),
      all(
        `SELECT n.id, n.kind, n.message, n.entity_id, n.read_at, n.created_at,
                actor.name AS actor_name
         FROM academy_notifications n LEFT JOIN users actor ON actor.id = n.actor_id
         WHERE n.user_id = ? ORDER BY n.created_at DESC LIMIT 30`,
        [userId],
      ),
      all(
        `SELECT u.id, u.name, COALESCE(p.xp, 0) AS xp
         FROM users u LEFT JOIN academy_points p ON p.user_id = u.id
         ORDER BY xp DESC, u.name COLLATE NOCASE LIMIT 20`,
      ),
      all(
        `SELECT a.id, a.title, a.description, a.xp_required,
                EXISTS(SELECT 1 FROM academy_user_achievements ua WHERE ua.achievement_id = a.id AND ua.user_id = ?) AS earned
         FROM academy_achievements a ORDER BY a.xp_required`,
        [userId],
      ),
      get(
        `SELECT COALESCE(p.xp, 0) AS xp,
                (SELECT COUNT(*) FROM academy_follows WHERE follower_id = ?) AS following_count,
                (SELECT COUNT(*) FROM academy_follows WHERE following_id = ?) AS follower_count,
                (SELECT COUNT(*) FROM academy_notifications WHERE user_id = ? AND read_at IS NULL) AS unread_count
         FROM users u LEFT JOIN academy_points p ON p.user_id = u.id WHERE u.id = ?`,
        [userId, userId, userId, userId],
      ),
    ])
  return res.json({ user, courses, posts, channels, groups, projects, events, notifications, leaderboard, achievements, stats })
})

app.get('/api/academy/courses/:courseId', authMiddleware, async (req, res) => {
  const courseId = academyId(req.params.courseId)
  if (!courseId) return res.status(400).json({ message: 'Kurs identifikatori noto‘g‘ri.' })
  const course = await get('SELECT * FROM academy_courses WHERE id = ?', [courseId])
  if (!course) return res.status(404).json({ message: 'Kurs topilmadi.' })
  const lessons = await all(
    `SELECT l.id, l.title, l.content, l.video_url, l.position,
            CASE WHEN p.lesson_id IS NULL THEN 0 ELSE 1 END AS completed
     FROM academy_lessons l
     LEFT JOIN academy_lesson_progress p ON p.lesson_id = l.id AND p.user_id = ?
     WHERE l.course_id = ? ORDER BY l.position, l.id`,
    [req.user.id, courseId],
  )
  const questions = await all(
    `SELECT id, question, option_a, option_b, option_c, position
     FROM academy_course_questions WHERE course_id = ? ORDER BY position, id`,
    [courseId],
  )
  const enrollment = await get(
    `SELECT e.completed_at, e.certificate_code, a.score, a.total, a.passed
     FROM academy_enrollments e
     LEFT JOIN academy_course_assessments a ON a.course_id = e.course_id AND a.user_id = e.user_id
     WHERE e.course_id = ? AND e.user_id = ?`,
    [courseId, req.user.id],
  )
  return res.json({ course, lessons, questions, enrollment: enrollment || null })
})

app.post('/api/academy/courses/:courseId/enroll', authMiddleware, async (req, res) => {
  const courseId = academyId(req.params.courseId)
  if (!courseId) return res.status(400).json({ message: 'Kurs identifikatori noto‘g‘ri.' })
  const course = await get('SELECT id FROM academy_courses WHERE id = ?', [courseId])
  if (!course) return res.status(404).json({ message: 'Kurs topilmadi.' })
  await run('INSERT OR IGNORE INTO academy_enrollments (user_id, course_id) VALUES (?, ?)', [req.user.id, courseId])
  return res.status(201).json({ ok: true })
})

app.post('/api/academy/lessons/:lessonId/complete', authMiddleware, async (req, res) => {
  const lessonId = academyId(req.params.lessonId)
  if (!lessonId) return res.status(400).json({ message: 'Dars identifikatori noto‘g‘ri.' })
  const lesson = await get('SELECT id, course_id FROM academy_lessons WHERE id = ?', [lessonId])
  if (!lesson) return res.status(404).json({ message: 'Dars topilmadi.' })
  const enrollment = await get(
    'SELECT user_id FROM academy_enrollments WHERE user_id = ? AND course_id = ?',
    [req.user.id, lesson.course_id],
  )
  if (!enrollment) return res.status(403).json({ message: 'Avval kursga yoziling.' })
  const result = await run(
    'INSERT OR IGNORE INTO academy_lesson_progress (user_id, lesson_id) VALUES (?, ?)',
    [req.user.id, lessonId],
  )
  if (result.changes) await awardAcademyXp(req.user.id, 10)
  const totals = await get(
    `SELECT COUNT(*) AS total,
            (SELECT COUNT(*) FROM academy_lesson_progress WHERE user_id = ? AND lesson_id IN
              (SELECT id FROM academy_lessons WHERE course_id = ?)) AS completed
     FROM academy_lessons WHERE course_id = ?`,
    [req.user.id, lesson.course_id, lesson.course_id],
  )
  const certificate = totals.total > 0 && totals.total === totals.completed
    ? await issueAcademyCertificate(req.user.id, lesson.course_id)
    : null
  return res.json({ ok: true, completed: totals.completed, total: totals.total, certificate })
})

app.post('/api/academy/courses/:courseId/assessment', authMiddleware, async (req, res) => {
  const courseId = academyId(req.params.courseId)
  const answers = req.body.answers
  if (!courseId || !answers || typeof answers !== 'object' || Array.isArray(answers)) {
    return res.status(400).json({ message: 'Test javoblari noto‘g‘ri.' })
  }
  const enrollment = await get(
    'SELECT 1 AS enrolled FROM academy_enrollments WHERE user_id = ? AND course_id = ?',
    [req.user.id, courseId],
  )
  if (!enrollment) return res.status(403).json({ message: 'Test topshirish uchun kursga yoziling.' })
  const questions = await all(
    'SELECT id, correct_option, explanation FROM academy_course_questions WHERE course_id = ? ORDER BY position, id',
    [courseId],
  )
  if (!questions.length) return res.status(404).json({ message: 'Kurs testi hali tayyorlanmagan.' })
  if (questions.some((question) => !['a', 'b', 'c'].includes(answers[question.id]))) {
    return res.status(400).json({ message: 'Testning barcha savollariga javob bering.' })
  }
  const score = questions.filter((question) => answers[question.id] === question.correct_option).length
  const passed = score / questions.length >= 0.7
  const previous = await get(
    'SELECT passed FROM academy_course_assessments WHERE user_id = ? AND course_id = ?',
    [req.user.id, courseId],
  )
  await run(
    `INSERT INTO academy_course_assessments (user_id, course_id, score, total, passed, updated_at)
     VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)
     ON CONFLICT(user_id, course_id) DO UPDATE SET
       score = excluded.score, total = excluded.total, passed = MAX(academy_course_assessments.passed, excluded.passed),
       updated_at = CURRENT_TIMESTAMP`,
    [req.user.id, courseId, score, questions.length, passed ? 1 : 0],
  )
  if (passed && !previous?.passed) await awardAcademyXp(req.user.id, 15)
  const certificate = passed ? await issueAcademyCertificate(req.user.id, courseId) : null
  const feedback = questions.map((question, index) => ({
    question: index + 1,
    correct: answers[question.id] === question.correct_option,
    explanation: question.explanation,
  }))
  return res.json({ score, total: questions.length, passed, feedback, certificate })
})

app.get('/api/academy/posts', authMiddleware, async (req, res) => {
  return res.json({ posts: await getAcademyPosts(req.user.id) })
})

app.post('/api/academy/posts', authMiddleware, async (req, res) => {
  const body = academyText(req.body.body, 3000)
  if (body.length < 2) return res.status(400).json({ message: 'Post matni kamida 2 belgidan iborat bo‘lsin.' })
  const saved = await run('INSERT INTO academy_posts (user_id, body) VALUES (?, ?)', [req.user.id, body])
  await awardAcademyXp(req.user.id, 5)
  return res.status(201).json({ id: saved.id })
})

app.post('/api/academy/posts/:postId/comments', authMiddleware, async (req, res) => {
  const postId = academyId(req.params.postId)
  const body = academyText(req.body.body, 1000)
  if (!postId || body.length < 1) return res.status(400).json({ message: 'Izoh matni yoki post identifikatori noto‘g‘ri.' })
  const post = await get('SELECT user_id FROM academy_posts WHERE id = ?', [postId])
  if (!post) return res.status(404).json({ message: 'Post topilmadi.' })
  const saved = await run(
    'INSERT INTO academy_comments (post_id, user_id, body) VALUES (?, ?, ?)',
    [postId, req.user.id, body],
  )
  await addAcademyNotification(post.user_id, req.user.id, 'comment', 'Postingizga yangi izoh yozildi.', postId)
  await awardAcademyXp(req.user.id, 2)
  return res.status(201).json({ id: saved.id })
})

app.post('/api/academy/posts/:postId/like', authMiddleware, async (req, res) => {
  const postId = academyId(req.params.postId)
  if (!postId) return res.status(400).json({ message: 'Post identifikatori noto‘g‘ri.' })
  const post = await get('SELECT user_id FROM academy_posts WHERE id = ?', [postId])
  if (!post) return res.status(404).json({ message: 'Post topilmadi.' })
  const current = await get('SELECT 1 AS liked FROM academy_likes WHERE post_id = ? AND user_id = ?', [postId, req.user.id])
  if (current) {
    await run('DELETE FROM academy_likes WHERE post_id = ? AND user_id = ?', [postId, req.user.id])
  } else {
    await run('INSERT INTO academy_likes (post_id, user_id) VALUES (?, ?)', [postId, req.user.id])
    await addAcademyNotification(post.user_id, req.user.id, 'like', 'Postingizga layk bosildi.', postId)
  }
  return res.json({ liked: !current })
})

app.post('/api/academy/users/:userId/follow', authMiddleware, async (req, res) => {
  const targetId = academyId(req.params.userId)
  if (!targetId || targetId === req.user.id) return res.status(400).json({ message: 'Obuna bo‘lish uchun boshqa foydalanuvchini tanlang.' })
  const target = await get('SELECT id FROM users WHERE id = ?', [targetId])
  if (!target) return res.status(404).json({ message: 'Foydalanuvchi topilmadi.' })
  const current = await get(
    'SELECT 1 AS following FROM academy_follows WHERE follower_id = ? AND following_id = ?',
    [req.user.id, targetId],
  )
  if (current) {
    await run('DELETE FROM academy_follows WHERE follower_id = ? AND following_id = ?', [req.user.id, targetId])
  } else {
    await run('INSERT INTO academy_follows (follower_id, following_id) VALUES (?, ?)', [req.user.id, targetId])
    await addAcademyNotification(targetId, req.user.id, 'follow', 'Sizga yangi foydalanuvchi obuna bo‘ldi.')
    await awardAcademyXp(req.user.id, 5)
  }
  return res.json({ following: !current })
})

app.get('/api/academy/users', authMiddleware, async (req, res) => {
  const users = await all(
    `SELECT u.id, u.name, COALESCE(p.xp, 0) AS xp,
            EXISTS(SELECT 1 FROM academy_follows f WHERE f.follower_id = ? AND f.following_id = u.id) AS following_by_me
     FROM users u LEFT JOIN academy_points p ON p.user_id = u.id
     WHERE u.id != ? ORDER BY u.name COLLATE NOCASE LIMIT 100`,
    [req.user.id, req.user.id],
  )
  return res.json({ users })
})

app.get('/api/academy/messages/:userId', authMiddleware, async (req, res) => {
  const otherId = academyId(req.params.userId)
  if (!otherId || otherId === req.user.id) return res.status(400).json({ message: 'Suhbatdosh identifikatori noto‘g‘ri.' })
  const other = await get('SELECT id, name FROM users WHERE id = ?', [otherId])
  if (!other) return res.status(404).json({ message: 'Foydalanuvchi topilmadi.' })
  const messages = await all(
    `SELECT id, sender_id, recipient_id, body, created_at, read_at
     FROM academy_messages
     WHERE (sender_id = ? AND recipient_id = ?) OR (sender_id = ? AND recipient_id = ?)
     ORDER BY created_at LIMIT 200`,
    [req.user.id, otherId, otherId, req.user.id],
  )
  await run(
    'UPDATE academy_messages SET read_at = CURRENT_TIMESTAMP WHERE sender_id = ? AND recipient_id = ? AND read_at IS NULL',
    [otherId, req.user.id],
  )
  return res.json({ user: other, messages })
})

app.post('/api/academy/messages', authMiddleware, async (req, res) => {
  const recipientId = academyId(req.body.recipientId)
  const body = academyText(req.body.body, 2000)
  if (!recipientId || recipientId === req.user.id || body.length < 1) {
    return res.status(400).json({ message: 'Xabar matni yoki qabul qiluvchi noto‘g‘ri.' })
  }
  const recipient = await get('SELECT id FROM users WHERE id = ?', [recipientId])
  if (!recipient) return res.status(404).json({ message: 'Qabul qiluvchi topilmadi.' })
  const saved = await run(
    'INSERT INTO academy_messages (sender_id, recipient_id, body) VALUES (?, ?, ?)',
    [req.user.id, recipientId, body],
  )
  await addAcademyNotification(recipientId, req.user.id, 'message', 'Sizga yangi shaxsiy xabar keldi.', saved.id)
  return res.status(201).json({ id: saved.id })
})

app.get('/api/academy/channels', authMiddleware, async (req, res) => {
  const channels = await all(
    `SELECT c.id, c.owner_id, c.title, c.description, u.name AS owner_name,
            cs.channel_type, cs.visibility, cs.category,
            COUNT(DISTINCT s.user_id) AS subscriber_count,
            (SELECT COUNT(*) FROM academy_channel_posts p WHERE p.channel_id = c.id) AS post_count,
            EXISTS(SELECT 1 FROM academy_channel_members mine
                   WHERE mine.channel_id = c.id AND mine.user_id = ? AND mine.status = 'active') AS subscribed_by_me
     FROM academy_channels c
     JOIN users u ON u.id = c.owner_id
     JOIN academy_channel_settings cs ON cs.channel_id = c.id
     LEFT JOIN academy_channel_subscriptions s ON s.channel_id = c.id
     WHERE cs.archived_at IS NULL
       AND (cs.visibility = 'public' OR EXISTS(
         SELECT 1 FROM academy_channel_members mine
         WHERE mine.channel_id = c.id AND mine.user_id = ? AND mine.status = 'active'
       ))
     GROUP BY c.id ORDER BY subscriber_count DESC, c.created_at DESC LIMIT 100`,
    [req.user.id, req.user.id],
  )
  return res.json({ channels })
})

app.post('/api/academy/channels', authMiddleware, async (req, res) => {
  const title = academyText(req.body.title, 80)
  const description = academyText(req.body.description, 500)
  const channelType = req.body.channelType || 'discussion'
  const visibility = channelType === 'private' ? 'private' : (req.body.visibility || 'public')
  const category = academyText(req.body.category, 60)
  if (title.length < 3) return res.status(400).json({ message: 'Kanal nomi kamida 3 belgidan iborat bo‘lsin.' })
  if (!validChannelTypes.has(channelType) || !['public', 'private'].includes(visibility)) {
    return res.status(400).json({ message: 'Kanal turi yoki ko‘rinish holati noto‘g‘ri.' })
  }
  const saved = await run(
    'INSERT INTO academy_channels (owner_id, title, description) VALUES (?, ?, ?)',
    [req.user.id, title, description],
  )
  await run(
    'INSERT INTO academy_channel_settings (channel_id, channel_type, visibility, category) VALUES (?, ?, ?, ?)',
    [saved.id, channelType, visibility, category],
  )
  await createChannelRoles(saved.id, req.user.id)
  return res.status(201).json({ id: saved.id })
})

app.post('/api/academy/channels/:channelId/subscribe', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  if (!channelId) return res.status(400).json({ message: 'Kanal identifikatori noto‘g‘ri.' })
  const access = await getChannelAccess(channelId, req.user.id)
  if (!access) return res.status(404).json({ message: 'Kanal topilmadi.' })
  const membership = await get(
    'SELECT status FROM academy_channel_members WHERE channel_id = ? AND user_id = ?',
    [channelId, req.user.id],
  )
  if (membership?.status === 'banned') return res.status(403).json({ message: 'Siz ushbu kanalga kira olmaysiz.' })
  const current = membership?.status === 'active' ? membership : null
  if (access.visibility === 'private' && !current) {
    return res.status(403).json({ message: 'Yopiq kanalga taklif yoki kirish so‘rovi orqali qo‘shiling.' })
  }
  if (current) {
    if (access.owner_id === req.user.id) return res.status(400).json({ message: 'Kanal egasi a’zolikdan chiqa olmaydi.' })
    await run('DELETE FROM academy_channel_members WHERE channel_id = ? AND user_id = ?', [channelId, req.user.id])
    await run('DELETE FROM academy_channel_subscriptions WHERE channel_id = ? AND user_id = ?', [channelId, req.user.id])
  } else {
    const role = await get(
      'SELECT id FROM academy_channel_roles WHERE channel_id = ? AND code = ?',
      [channelId, 'subscriber'],
    )
    await run(
      `INSERT INTO academy_channel_members (channel_id, user_id, role_id)
       VALUES (?, ?, ?) ON CONFLICT(channel_id, user_id) DO UPDATE SET role_id = excluded.role_id, status = 'active'`,
      [channelId, req.user.id, role.id],
    )
    await run('INSERT OR IGNORE INTO academy_channel_subscriptions (channel_id, user_id) VALUES (?, ?)', [channelId, req.user.id])
    await addAcademyNotification(access.owner_id, req.user.id, 'channel', 'Kanalingizga yangi obunachi qo‘shildi.', channelId)
  }
  return res.json({ subscribed: !current })
})

app.post('/api/academy/channels/:channelId/join-requests', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  if (!channelId) return res.status(400).json({ message: 'Kanal identifikatori noto‘g‘ri.' })
  const access = await getChannelAccess(channelId, req.user.id)
  if (!access) return res.status(404).json({ message: 'Kanal topilmadi.' })
  if (access.visibility !== 'private') return res.status(400).json({ message: 'Ochiq kanalga so‘rov yuborish shart emas.' })
  const membership = await get(
    'SELECT status FROM academy_channel_members WHERE channel_id = ? AND user_id = ?',
    [channelId, req.user.id],
  )
  if (membership?.status === 'banned') return res.status(403).json({ message: 'Siz ushbu kanalga kira olmaysiz.' })
  if (access.role_id) return res.status(400).json({ message: 'Siz allaqachon kanal a’zosisiz.' })
  await run(
    `INSERT INTO academy_channel_join_requests (channel_id, user_id, status)
     VALUES (?, ?, 'pending')
     ON CONFLICT(channel_id, user_id) DO UPDATE SET status = 'pending', reviewed_by = NULL, reviewed_at = NULL, created_at = CURRENT_TIMESTAMP`,
    [channelId, req.user.id],
  )
  return res.status(202).json({ requested: true })
})

app.get('/api/academy/channels/:channelId/join-requests', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId) return res.status(400).json({ message: 'Kanal identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'manage_members')) return
  const requests = await all(
    `SELECT r.id, r.user_id, u.name AS user_name, r.created_at
     FROM academy_channel_join_requests r JOIN users u ON u.id = r.user_id
     WHERE r.channel_id = ? AND r.status = 'pending' ORDER BY r.created_at`,
    [channelId],
  )
  return res.json({ requests })
})

app.patch('/api/academy/channels/:channelId/join-requests/:requestId', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const requestId = academyId(req.params.requestId)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId || !requestId) return res.status(400).json({ message: 'Kanal yoki so‘rov identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'manage_members')) return
  const decision = req.body.decision
  if (!['approve', 'reject'].includes(decision)) return res.status(400).json({ message: 'Qaror approve yoki reject bo‘lishi kerak.' })
  const joinRequest = await get(
    `SELECT user_id FROM academy_channel_join_requests
     WHERE id = ? AND channel_id = ? AND status = 'pending'`,
    [requestId, channelId],
  )
  if (!joinRequest) return res.status(404).json({ message: 'Faol kirish so‘rovi topilmadi.' })
  await run(
    `UPDATE academy_channel_join_requests SET status = ?, reviewed_by = ?, reviewed_at = CURRENT_TIMESTAMP
     WHERE id = ? AND status = 'pending'`,
    [decision === 'approve' ? 'approved' : 'rejected', req.user.id, requestId],
  )
  if (decision === 'approve') {
    const role = await get('SELECT id FROM academy_channel_roles WHERE channel_id = ? AND code = ?', [channelId, 'subscriber'])
    await run(
      `INSERT INTO academy_channel_members (channel_id, user_id, role_id)
       VALUES (?, ?, ?) ON CONFLICT(channel_id, user_id) DO UPDATE SET role_id = excluded.role_id, status = 'active'`,
      [channelId, joinRequest.user_id, role.id],
    )
    await run('INSERT OR IGNORE INTO academy_channel_subscriptions (channel_id, user_id) VALUES (?, ?)', [channelId, joinRequest.user_id])
    await addAcademyNotification(joinRequest.user_id, req.user.id, 'channel', 'Yopiq kanalga kirish so‘rovingiz tasdiqlandi.', channelId)
  }
  return res.json({ decision })
})

app.post('/api/academy/channels/:channelId/invites', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId) return res.status(400).json({ message: 'Kanal identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'manage_invites')) return
  const maxUses = Number(req.body.maxUses ?? 1)
  const expiresInHours = req.body.expiresInHours == null ? null : Number(req.body.expiresInHours)
  if (!Number.isInteger(maxUses) || maxUses < 1 || maxUses > 1000
      || (expiresInHours !== null && (!Number.isInteger(expiresInHours) || expiresInHours < 1 || expiresInHours > 8760))) {
    return res.status(400).json({ message: 'Taklif limiti yoki amal qilish muddati noto‘g‘ri.' })
  }
  const token = randomBytes(32).toString('base64url')
  const expiresAt = expiresInHours ? new Date(Date.now() + expiresInHours * 3600000).toISOString() : null
  await run(
    'INSERT INTO academy_channel_invites (channel_id, token_hash, created_by, max_uses, expires_at) VALUES (?, ?, ?, ?, ?)',
    [channelId, channelTokenHash(token), req.user.id, maxUses, expiresAt],
  )
  return res.status(201).json({ token, expiresAt, maxUses })
})

app.delete('/api/academy/channels/:channelId/invites/:inviteId', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const inviteId = academyId(req.params.inviteId)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId || !inviteId) return res.status(400).json({ message: 'Kanal yoki taklif identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'manage_invites')) return
  const result = await run(
    `UPDATE academy_channel_invites SET revoked_at = CURRENT_TIMESTAMP
     WHERE id = ? AND channel_id = ? AND revoked_at IS NULL`,
    [inviteId, channelId],
  )
  if (!result.changes) return res.status(404).json({ message: 'Faol taklif topilmadi.' })
  return res.json({ ok: true })
})

app.post('/api/academy/channel-invites/:token/accept', authMiddleware, async (req, res) => {
  const token = String(req.params.token || '')
  if (!/^[A-Za-z0-9_-]{40,50}$/.test(token)) return res.status(400).json({ message: 'Taklif havolasi noto‘g‘ri.' })
  const invite = await get(
    `SELECT i.id, i.channel_id, i.max_uses, i.use_count, c.owner_id
     FROM academy_channel_invites i JOIN academy_channels c ON c.id = i.channel_id
     WHERE i.token_hash = ? AND i.revoked_at IS NULL
       AND (i.expires_at IS NULL OR datetime(i.expires_at) > CURRENT_TIMESTAMP)
       AND i.use_count < i.max_uses`,
    [channelTokenHash(token)],
  )
  if (!invite) return res.status(404).json({ message: 'Taklif topilmadi yoki muddati tugagan.' })
  const membership = await get(
    'SELECT status FROM academy_channel_members WHERE channel_id = ? AND user_id = ?',
    [invite.channel_id, req.user.id],
  )
  if (membership) return res.status(409).json({ message: membership.status === 'active' ? 'Siz allaqachon kanal a’zosisiz.' : 'Siz ushbu kanalga kira olmaysiz.' })
  const role = await get(
    'SELECT id FROM academy_channel_roles WHERE channel_id = ? AND code = ?',
    [invite.channel_id, 'subscriber'],
  )
  const usage = await run(
    `UPDATE academy_channel_invites SET use_count = use_count + 1
     WHERE id = ? AND use_count < max_uses AND revoked_at IS NULL
       AND (expires_at IS NULL OR datetime(expires_at) > CURRENT_TIMESTAMP)`,
    [invite.id],
  )
  if (!usage.changes) return res.status(409).json({ message: 'Taklif limiti tugadi, yangi havola so‘rang.' })
  await run(
    `INSERT INTO academy_channel_members (channel_id, user_id, role_id)
     VALUES (?, ?, ?)`,
    [invite.channel_id, req.user.id, role.id],
  )
  await run('INSERT OR IGNORE INTO academy_channel_subscriptions (channel_id, user_id) VALUES (?, ?)', [invite.channel_id, req.user.id])
  await addAcademyNotification(invite.owner_id, req.user.id, 'channel', 'Kanalingizga yangi a’zo qo‘shildi.', invite.channel_id)
  return res.json({ channelId: invite.channel_id, joined: true })
})

app.get('/api/academy/channels/:channelId/members', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId) return res.status(400).json({ message: 'Kanal identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'manage_members')) return
  const members = await all(
    `SELECT m.user_id, u.name, r.code AS role, m.joined_at
     FROM academy_channel_members m JOIN users u ON u.id = m.user_id
     JOIN academy_channel_roles r ON r.id = m.role_id
     WHERE m.channel_id = ? AND m.status = 'active'
     ORDER BY r.position, u.name COLLATE NOCASE LIMIT 500`,
    [channelId],
  )
  return res.json({ members })
})

app.get('/api/academy/channels/:channelId/roles', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId) return res.status(400).json({ message: 'Kanal identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'manage_roles')) return
  const roles = await all(
    `SELECT code, name, permissions_json, position, is_builtin
     FROM academy_channel_roles WHERE channel_id = ? ORDER BY position, id`,
    [channelId],
  )
  return res.json({
    roles: roles.map((role) => ({
      code: role.code,
      name: role.name,
      permissions: JSON.parse(role.permissions_json),
      isBuiltin: Boolean(role.is_builtin),
    })),
  })
})

app.put('/api/academy/channels/:channelId/members/:userId/role', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const targetId = academyId(req.params.userId)
  const roleCode = academyText(req.body.role, 40)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId || !targetId) return res.status(400).json({ message: 'Kanal yoki foydalanuvchi identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'manage_roles')) return
  if (access.owner_id !== req.user.id || targetId === access.owner_id || roleCode === 'owner') {
    return res.status(403).json({ message: 'Faqat kanal egasi boshqa a’zolarga owner bo‘lmagan rol bera oladi.' })
  }
  const role = await get(
    'SELECT id FROM academy_channel_roles WHERE channel_id = ? AND code = ?',
    [channelId, roleCode],
  )
  if (!role) return res.status(404).json({ message: 'Kanal roli topilmadi.' })
  const result = await run(
    `UPDATE academy_channel_members SET role_id = ?
     WHERE channel_id = ? AND user_id = ? AND status = 'active'`,
    [role.id, channelId, targetId],
  )
  if (!result.changes) return res.status(404).json({ message: 'Faol kanal a’zosi topilmadi.' })
  return res.json({ ok: true })
})

app.post('/api/academy/channels/:channelId/roles', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const name = academyText(req.body.name, 50)
  const code = academyText(req.body.code, 32).toLowerCase()
  const permissions = req.body.permissions
  const allowedPermissions = new Set([
    'manage_channel', 'manage_roles', 'manage_members', 'manage_invites',
    'publish_posts', 'edit_own_posts', 'moderate_posts', 'view_analytics',
    'comment_posts', 'react_posts',
  ])
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId || name.length < 2 || !/^[a-z0-9_-]+$/.test(code)
      || !Array.isArray(permissions) || permissions.some((permission) => !allowedPermissions.has(permission))) {
    return res.status(400).json({ message: 'Rol nomi, kodi yoki ruxsatlar noto‘g‘ri.' })
  }
  if (channelPermissionError(res, access, req.user.id, 'manage_roles')) return
  if (access.owner_id !== req.user.id) return res.status(403).json({ message: 'Maxsus rollarni faqat kanal egasi yaratishi mumkin.' })
  const existing = await get('SELECT id FROM academy_channel_roles WHERE channel_id = ? AND code = ?', [channelId, code])
  if (existing) return res.status(409).json({ message: 'Bu rol kodi allaqachon ishlatilgan.' })
  const position = await get('SELECT COALESCE(MAX(position), 0) + 1 AS position FROM academy_channel_roles WHERE channel_id = ?', [channelId])
  const saved = await run(
    `INSERT INTO academy_channel_roles (channel_id, code, name, permissions_json, position)
     VALUES (?, ?, ?, ?, ?)`,
    [channelId, code, name, JSON.stringify([...new Set(permissions)]), position.position],
  )
  return res.status(201).json({ id: saved.id, code, name })
})

app.delete('/api/academy/channels/:channelId/members/:userId', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const targetId = academyId(req.params.userId)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId || !targetId) return res.status(400).json({ message: 'Kanal yoki foydalanuvchi identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'manage_members')) return
  if (targetId === access.owner_id) return res.status(400).json({ message: 'Kanal egasini chiqarib bo‘lmaydi.' })
  const result = await run('DELETE FROM academy_channel_members WHERE channel_id = ? AND user_id = ?', [channelId, targetId])
  await run('DELETE FROM academy_channel_subscriptions WHERE channel_id = ? AND user_id = ?', [channelId, targetId])
  if (!result.changes) return res.status(404).json({ message: 'Kanal a’zosi topilmadi.' })
  return res.json({ ok: true })
})

app.get('/api/academy/channels/:channelId/posts', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId) return res.status(400).json({ message: 'Kanal identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'read_channel')) return
  const beforeId = req.query.before ? academyId(req.query.before) : null
  const requestedLimit = Number(req.query.limit || 30)
  if ((req.query.before && !beforeId) || !Number.isInteger(requestedLimit) || requestedLimit < 1) {
    return res.status(400).json({ message: 'Sahifalash parametrlari noto‘g‘ri.' })
  }
  const limit = Math.min(requestedLimit, 100)
  const channel = await get(
    `SELECT c.id, c.owner_id, c.title, c.description, u.name AS owner_name,
            s.channel_type, s.visibility, s.category, s.archived_at,
            EXISTS(SELECT 1 FROM academy_channel_members m WHERE m.channel_id = c.id AND m.user_id = ? AND m.status = 'active') AS subscribed_by_me
     FROM academy_channels c JOIN users u ON u.id = c.owner_id
     JOIN academy_channel_settings s ON s.channel_id = c.id WHERE c.id = ?`,
    [req.user.id, channelId],
  )
  const posts = await all(
    `SELECT p.id, p.body, p.created_at, p.author_id, u.name AS author_name,
            (SELECT COUNT(*) FROM academy_channel_post_reactions r WHERE r.post_id = p.id) AS reaction_count,
            (SELECT COUNT(*) FROM academy_channel_comments c WHERE c.post_id = p.id) AS comment_count,
            EXISTS(SELECT 1 FROM academy_channel_post_pins pin WHERE pin.post_id = p.id) AS pinned,
            EXISTS(SELECT 1 FROM academy_channel_post_reactions mine
                   WHERE mine.post_id = p.id AND mine.user_id = ? AND mine.reaction = 'like') AS liked_by_me
     FROM academy_channel_posts p JOIN users u ON u.id = p.author_id
     JOIN academy_channel_post_state state ON state.post_id = p.id AND state.status = 'published'
     WHERE p.channel_id = ? AND (? IS NULL OR p.id < ?)
     ORDER BY p.id DESC LIMIT ?`,
    [req.user.id, channelId, beforeId, beforeId, limit],
  )
  for (const post of posts) {
    await run('INSERT OR IGNORE INTO academy_channel_post_views (post_id, user_id) VALUES (?, ?)', [post.id, req.user.id])
  }
  return res.json({ channel, posts, nextCursor: posts.length === limit ? posts[posts.length - 1].id : null })
})

app.post('/api/academy/channels/:channelId/posts', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const body = academyText(req.body.body, 3000)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId || body.length < 2) return res.status(400).json({ message: 'Post matni yoki kanal identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'publish_posts')) return
  const saved = await run(
    'INSERT INTO academy_channel_posts (channel_id, author_id, body) VALUES (?, ?, ?)',
    [channelId, req.user.id, body],
  )
  await run('INSERT INTO academy_channel_post_state (post_id, status) VALUES (?, ?)', [saved.id, 'published'])
  await awardAcademyXp(req.user.id, 3)
  const subscribers = await all(
    `SELECT user_id FROM academy_channel_members
     WHERE channel_id = ? AND status = 'active' AND user_id != ?`,
    [channelId, req.user.id],
  )
  for (const subscriber of subscribers) {
    await addAcademyNotification(subscriber.user_id, req.user.id, 'channel_post', `“${access.title}” kanalida yangi post.`, saved.id)
  }
  return res.status(201).json({ id: saved.id })
})

app.put('/api/academy/channels/:channelId/posts/:postId', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const postId = academyId(req.params.postId)
  const body = academyText(req.body.body, 3000)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId || !postId || body.length < 2) return res.status(400).json({ message: 'Post matni yoki identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'edit_own_posts')) return
  const post = await get('SELECT author_id FROM academy_channel_posts WHERE id = ? AND channel_id = ?', [postId, channelId])
  if (!post) return res.status(404).json({ message: 'Post topilmadi.' })
  if (post.author_id !== req.user.id && !hasChannelPermission({ ...access, user_id: req.user.id }, 'moderate_posts')) {
    return res.status(403).json({ message: 'Faqat post muallifi yoki moderator tahrirlay oladi.' })
  }
  await run('UPDATE academy_channel_posts SET body = ? WHERE id = ?', [body, postId])
  await run('UPDATE academy_channel_post_state SET updated_at = CURRENT_TIMESTAMP WHERE post_id = ?', [postId])
  return res.json({ ok: true })
})

app.delete('/api/academy/channels/:channelId/posts/:postId', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const postId = academyId(req.params.postId)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId || !postId) return res.status(400).json({ message: 'Kanal yoki post identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'moderate_posts')) return
  const result = await run('DELETE FROM academy_channel_posts WHERE id = ? AND channel_id = ?', [postId, channelId])
  if (!result.changes) return res.status(404).json({ message: 'Post topilmadi.' })
  return res.json({ ok: true })
})

app.get('/api/academy/channels/:channelId/posts/:postId/comments', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const postId = academyId(req.params.postId)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId || !postId) return res.status(400).json({ message: 'Kanal yoki post identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'read_channel')) return
  const comments = await all(
    `SELECT c.id, c.user_id, u.name AS user_name, c.body, c.created_at
     FROM academy_channel_comments c JOIN users u ON u.id = c.user_id
     JOIN academy_channel_posts p ON p.id = c.post_id
     WHERE p.id = ? AND p.channel_id = ? ORDER BY c.id LIMIT 200`,
    [postId, channelId],
  )
  return res.json({ comments })
})

app.post('/api/academy/channels/:channelId/posts/:postId/comments', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const postId = academyId(req.params.postId)
  const body = academyText(req.body.body, 1000)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId || !postId || !body) return res.status(400).json({ message: 'Izoh matni yoki identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'comment_posts')) return
  const post = await get('SELECT id FROM academy_channel_posts WHERE id = ? AND channel_id = ?', [postId, channelId])
  if (!post) return res.status(404).json({ message: 'Post topilmadi.' })
  const saved = await run(
    'INSERT INTO academy_channel_comments (post_id, user_id, body) VALUES (?, ?, ?)',
    [postId, req.user.id, body],
  )
  return res.status(201).json({ id: saved.id })
})

app.post('/api/academy/channels/:channelId/posts/:postId/reactions', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const postId = academyId(req.params.postId)
  const reaction = academyText(req.body.reaction, 20)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId || !postId || !['like', 'love', 'insightful', 'celebrate'].includes(reaction)) {
    return res.status(400).json({ message: 'Reaksiya yoki identifikator noto‘g‘ri.' })
  }
  if (channelPermissionError(res, access, req.user.id, 'react_posts')) return
  const post = await get('SELECT id FROM academy_channel_posts WHERE id = ? AND channel_id = ?', [postId, channelId])
  if (!post) return res.status(404).json({ message: 'Post topilmadi.' })
  const existing = await get(
    'SELECT 1 AS exists_reaction FROM academy_channel_post_reactions WHERE post_id = ? AND user_id = ? AND reaction = ?',
    [postId, req.user.id, reaction],
  )
  if (existing) {
    await run(
      'DELETE FROM academy_channel_post_reactions WHERE post_id = ? AND user_id = ? AND reaction = ?',
      [postId, req.user.id, reaction],
    )
  } else {
    await run(
      'INSERT INTO academy_channel_post_reactions (post_id, user_id, reaction) VALUES (?, ?, ?)',
      [postId, req.user.id, reaction],
    )
  }
  return res.json({ reacted: !existing, reaction })
})

app.put('/api/academy/channels/:channelId/posts/:postId/pin', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const postId = academyId(req.params.postId)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId || !postId) return res.status(400).json({ message: 'Kanal yoki post identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'moderate_posts')) return
  const post = await get('SELECT id FROM academy_channel_posts WHERE id = ? AND channel_id = ?', [postId, channelId])
  if (!post) return res.status(404).json({ message: 'Post topilmadi.' })
  const pinned = await get('SELECT 1 AS pinned FROM academy_channel_post_pins WHERE channel_id = ? AND post_id = ?', [channelId, postId])
  if (pinned) {
    await run('DELETE FROM academy_channel_post_pins WHERE channel_id = ? AND post_id = ?', [channelId, postId])
  } else {
    await run(
      'INSERT INTO academy_channel_post_pins (channel_id, post_id, pinned_by) VALUES (?, ?, ?)',
      [channelId, postId, req.user.id],
    )
  }
  return res.json({ pinned: !pinned })
})

app.get('/api/academy/channels/:channelId/analytics', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const access = channelId ? await getChannelAccess(channelId, req.user.id) : null
  if (!channelId) return res.status(400).json({ message: 'Kanal identifikatori noto‘g‘ri.' })
  if (channelPermissionError(res, access, req.user.id, 'view_analytics')) return
  const analytics = await get(
    `SELECT
       (SELECT COUNT(*) FROM academy_channel_members WHERE channel_id = ? AND status = 'active') AS members,
       (SELECT COUNT(*) FROM academy_channel_posts WHERE channel_id = ?) AS posts,
       (SELECT COUNT(*) FROM academy_channel_post_views v JOIN academy_channel_posts p ON p.id = v.post_id WHERE p.channel_id = ?) AS views,
       (SELECT COUNT(*) FROM academy_channel_post_reactions r JOIN academy_channel_posts p ON p.id = r.post_id WHERE p.channel_id = ?) AS reactions,
       (SELECT COUNT(*) FROM academy_channel_comments c JOIN academy_channel_posts p ON p.id = c.post_id WHERE p.channel_id = ?) AS comments`,
    [channelId, channelId, channelId, channelId, channelId],
  )
  return res.json({ analytics })
})

app.put('/api/academy/channels/:channelId', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  const title = academyText(req.body.title, 80)
  const description = academyText(req.body.description, 500)
  const channelType = req.body.channelType || 'discussion'
  const visibility = channelType === 'private' ? 'private' : (req.body.visibility || 'public')
  const category = academyText(req.body.category, 60)
  if (!channelId || title.length < 3) return res.status(400).json({ message: 'Kanal nomi yoki identifikatori noto‘g‘ri.' })
  if (!validChannelTypes.has(channelType) || !['public', 'private'].includes(visibility)) {
    return res.status(400).json({ message: 'Kanal turi yoki ko‘rinish holati noto‘g‘ri.' })
  }
  const access = await getChannelAccess(channelId, req.user.id)
  if (channelPermissionError(res, access, req.user.id, 'manage_channel')) return
  if (access.owner_id !== req.user.id) return res.status(403).json({ message: 'Kanal sozlamalarini faqat egasi o‘zgartira oladi.' })
  await run('UPDATE academy_channels SET title = ?, description = ? WHERE id = ?', [title, description, channelId])
  await run(
    'UPDATE academy_channel_settings SET channel_type = ?, visibility = ?, category = ? WHERE channel_id = ?',
    [channelType, visibility, category, channelId],
  )
  return res.json({ ok: true })
})

app.delete('/api/academy/channels/:channelId', authMiddleware, async (req, res) => {
  const channelId = academyId(req.params.channelId)
  if (!channelId) return res.status(400).json({ message: 'Kanal identifikatori noto‘g‘ri.' })
  const result = await run('DELETE FROM academy_channels WHERE id = ? AND owner_id = ?', [channelId, req.user.id])
  if (!result.changes) return res.status(404).json({ message: 'Kanal topilmadi yoki sizga tegishli emas.' })
  return res.json({ ok: true })
})

app.post('/api/academy/groups', authMiddleware, async (req, res) => {
  const title = academyText(req.body.title, 100)
  const description = academyText(req.body.description, 500)
  const category = academyText(req.body.category, 60) || 'Qiziqish'
  if (title.length < 3) return res.status(400).json({ message: 'Guruh nomi kamida 3 belgidan iborat bo‘lsin.' })
  const saved = await run(
    'INSERT INTO academy_groups (title, description, category, created_by) VALUES (?, ?, ?, ?)',
    [title, description, category, req.user.id],
  )
  await run('INSERT INTO academy_group_members (group_id, user_id) VALUES (?, ?)', [saved.id, req.user.id])
  await awardAcademyXp(req.user.id, 5)
  return res.status(201).json({ id: saved.id })
})

app.post('/api/academy/groups/:groupId/join', authMiddleware, async (req, res) => {
  const groupId = academyId(req.params.groupId)
  if (!groupId) return res.status(400).json({ message: 'Guruh identifikatori noto‘g‘ri.' })
  const group = await get('SELECT id FROM academy_groups WHERE id = ?', [groupId])
  if (!group) return res.status(404).json({ message: 'Guruh topilmadi.' })
  const current = await get(
    'SELECT 1 AS joined FROM academy_group_members WHERE group_id = ? AND user_id = ?',
    [groupId, req.user.id],
  )
  if (current) {
    await run('DELETE FROM academy_group_members WHERE group_id = ? AND user_id = ?', [groupId, req.user.id])
  } else {
    await run('INSERT INTO academy_group_members (group_id, user_id) VALUES (?, ?)', [groupId, req.user.id])
  }
  return res.json({ joined: !current })
})

app.post('/api/academy/projects', authMiddleware, async (req, res) => {
  const title = academyText(req.body.title, 120)
  const description = academyText(req.body.description, 2000)
  const url = academyText(req.body.url, 500)
  const type = academyText(req.body.type, 40) || 'Loyiha'
  if (title.length < 3 || description.length < 10) {
    return res.status(400).json({ message: 'Loyiha nomi va kamida 10 belgilik tavsif kiriting.' })
  }
  if (url && !/^https?:\/\/\S+$/i.test(url)) return res.status(400).json({ message: 'Havola http:// yoki https:// bilan boshlansin.' })
  const saved = await run(
    'INSERT INTO academy_projects (user_id, title, description, url, type) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, title, description, url, type],
  )
  await awardAcademyXp(req.user.id, 10)
  return res.status(201).json({ id: saved.id })
})

app.delete('/api/academy/projects/:projectId', authMiddleware, async (req, res) => {
  const projectId = academyId(req.params.projectId)
  if (!projectId) return res.status(400).json({ message: 'Loyiha identifikatori noto‘g‘ri.' })
  const result = await run('DELETE FROM academy_projects WHERE id = ? AND user_id = ?', [projectId, req.user.id])
  if (!result.changes) return res.status(404).json({ message: 'Loyiha topilmadi yoki sizga tegishli emas.' })
  return res.json({ ok: true })
})

app.post('/api/academy/events/:eventId/attend', authMiddleware, async (req, res) => {
  const eventId = academyId(req.params.eventId)
  if (!eventId) return res.status(400).json({ message: 'Tadbir identifikatori noto‘g‘ri.' })
  const event = await get('SELECT id FROM academy_events WHERE id = ?', [eventId])
  if (!event) return res.status(404).json({ message: 'Tadbir topilmadi.' })
  const current = await get(
    'SELECT 1 AS attending FROM academy_event_attendees WHERE event_id = ? AND user_id = ?',
    [eventId, req.user.id],
  )
  if (current) {
    await run('DELETE FROM academy_event_attendees WHERE event_id = ? AND user_id = ?', [eventId, req.user.id])
  } else {
    await run('INSERT INTO academy_event_attendees (event_id, user_id) VALUES (?, ?)', [eventId, req.user.id])
  }
  return res.json({ attending: !current })
})

app.post('/api/academy/notifications/read', authMiddleware, async (req, res) => {
  const ids = Array.isArray(req.body.ids) ? req.body.ids.map(academyId).filter(Boolean).slice(0, 100) : []
  if (!ids.length) {
    await run('UPDATE academy_notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND read_at IS NULL', [req.user.id])
  } else {
    await run(
      `UPDATE academy_notifications SET read_at = CURRENT_TIMESTAMP WHERE user_id = ? AND id IN (${ids.map(() => '?').join(',')})`,
      [req.user.id, ...ids],
    )
  }
  return res.json({ ok: true })
})

app.post('/api/academy/tutor', authMiddleware, async (req, res) => {
  const question = academyText(req.body.question, 500)
  if (question.length < 3) return res.status(400).json({ message: 'Savol kamida 3 belgidan iborat bo‘lsin.' })
  const sources = await searchLegalArticles({ query: question, limit: 5 })
  if (!sources.length) {
    return res.json({
      answer: 'Import qilingan LexUZ matnlaridan savolingizga mos qoida topilmadi. Shuning uchun huquqiy javobni taxmin qilmayman. Mavzuga oid kalit so‘z yoki kodeks nomi bilan qayta so‘rang.',
      sources: [],
    })
  }
  return res.json({
    answer: 'Quyidagi izoh faqat import qilingan LexUZ moddalaridagi matnga tayangan. Moddalarni to‘liq o‘qib, savoldagi aniq faktlar bilan solishtiring; huquqiy xulosa va muddatlar vaziyatga qarab farq qilishi mumkin.',
    sources: sources.map((source) => ({
      lawTitle: source.law_title,
      articleNumber: source.article_number,
      title: source.title,
      text: source.text,
      url: source.source_url,
    })),
  })
})

app.get('/api/academy/admin', authMiddleware, academyAdminMiddleware, async (req, res) => {
  const [counts, users, posts, courses, events] = await Promise.all([
    get(`SELECT
      (SELECT COUNT(*) FROM users) AS users,
      (SELECT COUNT(*) FROM academy_posts) AS posts,
      (SELECT COUNT(*) FROM academy_courses) AS courses,
      (SELECT COUNT(*) FROM academy_events) AS events`),
    all(
      `SELECT u.id, u.name, u.email, u.role, u.created_at, COALESCE(p.xp, 0) AS xp
       FROM users u LEFT JOIN academy_points p ON p.user_id = u.id
       ORDER BY u.created_at DESC LIMIT 100`,
    ),
    all(
      `SELECT p.id, p.body, p.created_at, u.name AS author_name
       FROM academy_posts p JOIN users u ON u.id = p.user_id
       ORDER BY p.created_at DESC LIMIT 50`,
    ),
    all(
      `SELECT c.id, c.title, c.description, c.subject, c.level,
              COUNT(l.id) AS lesson_count
       FROM academy_courses c LEFT JOIN academy_lessons l ON l.course_id = c.id
       GROUP BY c.id ORDER BY c.created_at DESC`,
    ),
    all('SELECT id, title, event_at, location FROM academy_events ORDER BY event_at DESC LIMIT 50'),
  ])
  return res.json({ counts, users, posts, courses, events })
})

app.post('/api/academy/admin/courses', authMiddleware, academyAdminMiddleware, async (req, res) => {
  const title = academyText(req.body.title, 120)
  const description = academyText(req.body.description, 1000)
  const subject = academyText(req.body.subject, 80) || 'Huquq'
  const level = academyText(req.body.level, 40) || 'Boshlang‘ich'
  const lessons = Array.isArray(req.body.lessons) ? req.body.lessons.slice(0, 100) : []
  const questions = Array.isArray(req.body.questions) ? req.body.questions.slice(0, 50) : []
  if (title.length < 3 || description.length < 10 || !lessons.length || !questions.length) {
    return res.status(400).json({ message: 'Kurs nomi, tavsifi, kamida bitta dars va test savoli kiriting.' })
  }
  const validLessons = lessons.map((lesson) => ({
    title: academyText(lesson.title, 120),
    content: academyText(lesson.content, 6000),
    videoUrl: academyText(lesson.videoUrl, 500),
  }))
  if (validLessons.some((lesson) =>
    !lesson.title || !lesson.content || (lesson.videoUrl && !/^https?:\/\/\S+$/i.test(lesson.videoUrl)),
  )) {
    return res.status(400).json({ message: 'Har bir dars nomi va matnini to‘ldiring, video havolasi http(s):// bilan boshlansin.' })
  }
  const validQuestions = questions.map((question) => ({
    question: academyText(question.question, 500),
    optionA: academyText(question.optionA, 250),
    optionB: academyText(question.optionB, 250),
    optionC: academyText(question.optionC, 250),
    correctOption: academyText(question.correctOption, 1),
    explanation: academyText(question.explanation, 1000),
  }))
  if (validQuestions.some((question) =>
    !question.question || !question.optionA || !question.optionB || !question.optionC ||
    !['a', 'b', 'c'].includes(question.correctOption),
  )) {
    return res.status(400).json({ message: 'Test savoli, uchta javob varianti va to‘g‘ri javobni to‘ldiring.' })
  }
  const slug = `${Date.now()}-${randomUUID().slice(0, 8)}`
  const saved = await run(
    'INSERT INTO academy_courses (slug, title, description, subject, level, created_by) VALUES (?, ?, ?, ?, ?, ?)',
    [slug, title, description, subject, level, req.user.id],
  )
  for (const [index, lesson] of validLessons.entries()) {
    await run(
      'INSERT INTO academy_lessons (course_id, title, content, video_url, position) VALUES (?, ?, ?, ?, ?)',
      [saved.id, lesson.title, lesson.content, lesson.videoUrl, index + 1],
    )
  }
  for (const [index, question] of validQuestions.entries()) {
    await run(
      `INSERT INTO academy_course_questions
       (course_id, question, option_a, option_b, option_c, correct_option, explanation, position)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [saved.id, question.question, question.optionA, question.optionB, question.optionC, question.correctOption, question.explanation, index + 1],
    )
  }
  return res.status(201).json({ id: saved.id })
})

app.post('/api/academy/admin/groups', authMiddleware, academyAdminMiddleware, async (req, res) => {
  const title = academyText(req.body.title, 100)
  const description = academyText(req.body.description, 500)
  const category = academyText(req.body.category, 60) || 'Qiziqish'
  if (title.length < 3) return res.status(400).json({ message: 'Guruh nomi kamida 3 belgidan iborat bo‘lsin.' })
  const saved = await run(
    'INSERT INTO academy_groups (title, description, category, created_by) VALUES (?, ?, ?, ?)',
    [title, description, category, req.user.id],
  )
  return res.status(201).json({ id: saved.id })
})

app.post('/api/academy/admin/events', authMiddleware, academyAdminMiddleware, async (req, res) => {
  const title = academyText(req.body.title, 120)
  const description = academyText(req.body.description, 1000)
  const eventAt = academyText(req.body.eventAt, 40)
  const location = academyText(req.body.location, 160) || 'Onlayn'
  if (title.length < 3 || !Number.isFinite(Date.parse(eventAt))) {
    return res.status(400).json({ message: 'Tadbir nomi va to‘g‘ri sana-vaqt kiriting.' })
  }
  const saved = await run(
    'INSERT INTO academy_events (title, description, event_at, location, created_by) VALUES (?, ?, ?, ?, ?)',
    [title, description, new Date(eventAt).toISOString(), location, req.user.id],
  )
  const users = await all('SELECT id FROM users WHERE id != ?', [req.user.id])
  for (const user of users) {
    await addAcademyNotification(user.id, req.user.id, 'event', `Yangi tadbir: ${title}`, saved.id)
  }
  return res.status(201).json({ id: saved.id })
})

app.delete('/api/academy/admin/posts/:postId', authMiddleware, academyAdminMiddleware, async (req, res) => {
  const postId = academyId(req.params.postId)
  if (!postId) return res.status(400).json({ message: 'Post identifikatori noto‘g‘ri.' })
  const result = await run('DELETE FROM academy_posts WHERE id = ?', [postId])
  if (!result.changes) return res.status(404).json({ message: 'Post topilmadi.' })
  return res.json({ ok: true })
})

app.get('/api/health', (req, res) => {
  res.json({ ok: true, message: 'Huquqiy yordamchi serveri ishlayapti' })
})

const normalizeLegalQuery = (value) => value.trim().replace(/\s+/g, ' ')

const latinToCyrillic = (value) =>
  value
    .replace(/g[’'ʻ`]/g, 'ғ')
    .replace(/o[’'ʻ`]/g, 'ў')
    .replace(/sh/g, 'ш')
    .replace(/ch/g, 'ч')
    .replace(/yo/g, 'ё')
    .replace(/yu/g, 'ю')
    .replace(/ya/g, 'я')
    .replace(/a/g, 'а')
    .replace(/b/g, 'б')
    .replace(/d/g, 'д')
    .replace(/e/g, 'е')
    .replace(/f/g, 'ф')
    .replace(/g/g, 'г')
    .replace(/h/g, 'ҳ')
    .replace(/i/g, 'и')
    .replace(/j/g, 'ж')
    .replace(/k/g, 'к')
    .replace(/l/g, 'л')
    .replace(/m/g, 'м')
    .replace(/n/g, 'н')
    .replace(/o/g, 'о')
    .replace(/p/g, 'п')
    .replace(/q/g, 'қ')
    .replace(/r/g, 'р')
    .replace(/s/g, 'с')
    .replace(/t/g, 'т')
    .replace(/u/g, 'у')
    .replace(/v/g, 'в')
    .replace(/x/g, 'х')
    .replace(/y/g, 'й')
    .replace(/z/g, 'з')

const getLegalSearchTerms = (query) => {
  const normalize = (value) => value.toLocaleLowerCase('uz').replace(/[’ʻ`]/g, "'")
  const original = normalize(query)
  const transliterated = latinToCyrillic(original)
  return [...new Set(`${original} ${transliterated}`.match(/[\p{L}\d-]{2,}/gu) || [])]
    .filter((term) => !['bilan', 'uchun', 'qanday', 'kerak', 'botsa', 'menga', 'men'].includes(term))
    .slice(0, 12)
}

const searchLegalArticles = async ({ query, lawId, limit = 30 }) => {
  const terms = getLegalSearchTerms(query)
  if (!terms.length) return []

  const termSql = terms.map(() => '(a.article_number = ? OR a.title LIKE ? OR a.text LIKE ? OR d.title LIKE ?)').join(' OR ')
  const params = []
  for (const term of terms) params.push(term, `%${term}%`, `%${term}%`, `%${term}%`)
  let where = `(${termSql})`
  if (lawId) {
    where += ' AND a.law_id = ?'
    params.push(lawId)
  }

  const rows = await all(
    `SELECT a.id, a.law_id, d.title AS law_title, d.type AS law_type, d.area,
            a.article_number, a.title, a.text, a.section_title, a.chapter_title,
            a.source_url, a.source_anchor, a.updated_at
     FROM legal_articles a
     JOIN legal_documents d ON d.id = a.law_id
     WHERE ${where}
     LIMIT ?`,
    [...params, limit * 5],
  )

  const ranked = rows.map((article) => {
    const title = article.title.toLocaleLowerCase('uz')
    const body = article.text.toLocaleLowerCase('uz')
    const score = terms.reduce(
      (total, term) =>
        total +
        (article.article_number === term ? 100 : 0) +
        (title.includes(term) ? 20 : 0) +
        (body.includes(term) ? 1 : 0),
      0,
    )
    return { ...article, score, source_url: article.source_anchor ? `${article.source_url}#${article.source_anchor}` : article.source_url }
  })

  return ranked.sort((left, right) => right.score - left.score).slice(0, limit)
}

app.get('/api/legal/documents', async (req, res) => {
  const { area } = req.query
  const params = area ? [area] : []
  const where = area ? 'WHERE d.area = ?' : ''
  const documents = await all(
    `SELECT d.id, d.title, d.lex_title, d.lex_document_id, d.type, d.area,
            d.source_url, d.source_checked_at,
            COUNT(a.id) AS article_count
     FROM legal_documents d
     LEFT JOIN legal_articles a ON a.law_id = d.id
     ${where}
     GROUP BY d.id
     ORDER BY d.title COLLATE NOCASE`,
    params,
  )
  return res.json({ documents })
})

app.get('/api/legal/documents/:lawId/articles', async (req, res) => {
  const document = await get('SELECT id, title FROM legal_documents WHERE id = ?', [req.params.lawId])
  if (!document) return res.status(404).json({ message: 'Hujjat topilmadi. Avval LexUZ ma’lumotlarini import qiling.' })

  const requestedLimit = Number.parseInt(req.query.limit, 10)
  const requestedOffset = Number.parseInt(req.query.offset, 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 100) : 50
  const offset = Number.isFinite(requestedOffset) ? Math.max(requestedOffset, 0) : 0
  const articles = await all(
    `SELECT id, law_id, article_number, title, text, section_title, chapter_title,
            source_url, source_anchor, updated_at
     FROM legal_articles WHERE law_id = ? ORDER BY id LIMIT ? OFFSET ?`,
    [req.params.lawId, limit, offset],
  )
  return res.json({ document, articles, limit, offset })
})

app.get('/api/legal/search', async (req, res) => {
  const query = normalizeLegalQuery(String(req.query.q || ''))
  const lawId = req.query.lawId ? String(req.query.lawId) : ''
  if (query.length > 160) return res.status(400).json({ message: 'Qidiruv so‘rovi 160 belgidan oshmasligi kerak.' })
  if (!query) return res.status(400).json({ message: 'Modda raqami yoki kalit so‘zni kiriting.' })

  const articles = await searchLegalArticles({ query, lawId, limit: 50 })
  return res.json({ query, articles })
})

app.get('/api/legal/articles/:articleId', async (req, res) => {
  const articleId = Number.parseInt(req.params.articleId, 10)
  if (!Number.isSafeInteger(articleId) || articleId < 1) {
    return res.status(400).json({ message: 'Modda identifikatori noto‘g‘ri.' })
  }

  const article = await get(
    `SELECT a.id, a.law_id, d.title AS law_title, d.type AS law_type, d.area,
            a.article_number, a.title, a.text, a.section_title, a.chapter_title,
            a.source_url, a.source_anchor, a.updated_at
     FROM legal_articles a JOIN legal_documents d ON d.id = a.law_id
     WHERE a.id = ?`,
    [articleId],
  )
  if (!article) return res.status(404).json({ message: 'Modda topilmadi.' })

  article.source_url = article.source_anchor ? `${article.source_url}#${article.source_anchor}` : article.source_url
  const previous = await get(
    `SELECT id, article_number, title
     FROM legal_articles WHERE law_id = ? AND id < ?
     ORDER BY id DESC LIMIT 1`,
    [article.law_id, article.id],
  )
  const next = await get(
    'SELECT id, article_number, title FROM legal_articles WHERE law_id = ? AND id > ? ORDER BY id LIMIT 1',
    [article.law_id, article.id],
  )
  return res.json({ article, previous: previous || null, next: next || null })
})

app.get('/api/legal/flashcards', async (req, res) => {
  const requestedLimit = Number.parseInt(req.query.limit, 10)
  const limit = Number.isFinite(requestedLimit) ? Math.min(Math.max(requestedLimit, 1), 30) : 12
  const articles = await all(
    `SELECT a.id, a.law_id, d.title AS law_title, a.article_number, a.title,
            a.text, a.source_url, a.source_anchor
     FROM legal_articles a
     JOIN legal_documents d ON d.id = a.law_id
     WHERE length(a.text) > 40
     ORDER BY RANDOM()
     LIMIT ?`,
    [limit],
  )
  return res.json({
    flashcards: articles.map((article) => ({
      ...article,
      source_url: article.source_anchor ? `${article.source_url}#${article.source_anchor}` : article.source_url,
    })),
  })
})

app.post('/api/legal/advice', async (req, res) => {
  const query = normalizeLegalQuery(String(req.body.question || ''))
  if (query.length < 3 || query.length > 1000) {
    return res.status(400).json({ message: 'Savol 3 dan 1000 belgigacha bo‘lishi kerak.' })
  }

  const sources = await searchLegalArticles({ query, limit: 8 })
  if (!sources.length) {
    return res.json({
      answer: {
        title: 'Tekshirilgan modda topilmadi',
        law: 'LexUZ’dan import qilingan hujjatlar bazasi',
        summary: 'Savolingizga bog‘liq modda import qilingan rasmiy matnlardan topilmadi. Hozircha huquqiy xulosa tuzmayman.',
        rules: [],
        steps: [
          'Savolga kodeks yoki hujjat nomini qo‘shib qayta qidiring.',
          'LexUZ rasmiy matnini ochib, tegishli normalarni tekshiring.',
          'Murakkab yoki muddatga bog‘liq vaziyatda advokat bilan maslahat qiling.',
        ],
        docs: [],
        deadlines: 'Tegishli moddalarda sud yoki shikoyat uchun aniq muddat aniqlanmadi. Vaziyatga tatbiq etiladigan LexUZ normasidan muddatni alohida tekshiring.',
        sampleApplication: [
          'Kimga: [vakolatli tashkilot yoki shaxs]',
          'Kimdan: [F.I.Sh., aloqa ma’lumotlari]',
          '',
          'ARIZA / TALABNOMA',
          '',
          'Men, [F.I.Sh.], [sana] kuni yuz bergan quyidagi holat bo‘yicha murojaat qilaman: [faktlarni sanalar bilan bayon qiling].',
          '[Aniq talabingizni va javob berish uchun aloqa manzilini yozing.]',
          '',
          'Ilovalar: [dalillar va hujjatlar ro‘yxati]',
          'Sana: [sana]    Imzo: [imzo]',
        ].join('\n'),
        caution: 'Mos modda topilmagani sababli bu yordamchi huquqiy xulosa bermaydi va muddatlarni taxmin qilmaydi.',
        contact: 'LexUZ rasmiy manbasi yoki malakali advokat',
        sources: [],
      },
    })
  }

  const text = query.toLocaleLowerCase('uz')
  let scenario = 'Umumiy huquqiy vaziyat'
  let steps = [
    'Voqealar ketma-ketligi, sanalar va qatnashgan tomonlarni yozib chiqing.',
    'Shartnoma, yozishmalar, to‘lov hujjatlari va qarorlarning nusxalarini saqlang.',
    'Tegishli moddaning LexUZ’dagi amaldagi tahririni ochib, shartlari vaziyatingizga mosligini tekshiring.',
    'Nizo bartaraf etilmasa, vakolatli organ yoki sudga murojaat qilish tartibini mutaxassis bilan aniqlang.',
  ]
  let docs = ['Vaziyatga oid shartnoma va ilovalar', 'Сана кўрсатилган ёзишмалар ва тўлов далиллари', 'Аввалги мурожаатлар ва жавоблар']
  let contact = 'Nizo turiga vakolatli organ; hududiy va protsessual vakolatni alohida tekshiring.'

  if (/ишдан бўшат|ishdan bo‘shat|ishdan bushat|меҳнат шартномаси|mehnat shartnomasi/i.test(text)) {
    scenario = 'Ishdan bo‘shatish yoki mehnat munosabati bo‘yicha nizo'
    steps = [
      'Ishdan bo‘shatish buyrug‘i va uning sanasini yozma ravishda oling.',
      'Mehnat shartnomasi, ish jadvali, ish haqi hujjatlari va ish beruvchi bilan yozishmalarni saqlang.',
      'LexUZ’dan topilgan moddalarning amaldagi tahriri va sudga murojaat muddatini tekshiring.',
      'Ish beruvchiga yozma murojaat yuboring; hal bo‘lmasa vakolatli mehnat organi yoki sudga murojaat tartibini aniqlang.',
    ]
    docs = ['Mehnat shartnomasi', 'Ishdan bo‘shatish buyrug‘i', 'Ish haqi va ish vaqtiga oid hujjatlar', 'Ish beruvchi bilan yozishmalar']
    contact = 'Ish beruvchi, mehnat masalalari bo‘yicha vakolatli organ yoki mehnat nizolarini ko‘ruvchi sud.'
  } else if (/иш ҳақи|ish haqi|maosh|oylik|зарарни қоплаш|иш ҳақи/i.test(text)) {
    scenario = 'Ish haqi yoki mehnat to‘lovi bo‘yicha nizo'
    docs = ['Mehnat shartnomasi', 'Hisob-kitob varaqalari', 'Bank ko‘chirmalari va ish jadvali', 'Yozma talab va unga javob']
    contact = 'Ish beruvchi, mehnat masalalari bo‘yicha vakolatli organ yoki sud.'
  } else if (/алимент|aliment|нафақа|ажраш|nikoh|oila/i.test(text)) {
    scenario = 'Oila munosabati, aliment yoki bola ta’minoti'
    docs = ['Shaxsni va qarindoshlikni tasdiqlovchi hujjatlar', 'Bola va ta’minot xarajatlariga oid hujjatlar', 'Tomonlar kelishuvi yoki yozishmalar']
    contact = 'FHDYO, tegishli vasiylik organi yoki sud; qaysi organ vakolatli ekanini holat bo‘yicha tekshiring.'
  } else if (/қарз|qarz|ундир|undirish|тилхат|tilxat/i.test(text)) {
    scenario = 'Qarz yoki majburiyatni undirish'
    docs = ['Qarz shartnomasi yoki tilxat', 'Pul o‘tkazmasi dalillari', 'Qarzdorga yuborilgan yozma talab va yetkazilganini tasdiqlovchi dalil']
    contact = 'Qarzdor bilan yozma talab orqali bog‘laning; nizo hal bo‘lmasa fuqarolik sudiga murojaat tartibini tekshiring.'
  } else if (/ижара|ijara|уй-жой|uy-joy|квартира/i.test(text)) {
    scenario = 'Ijara yoki uy-joy munosabati'
    docs = ['Ijara shartnomasi va topshirish-qabul qilish dalolatnomasi', 'To‘lovlar dalili', 'Uy-joy holatini ko‘rsatuvchi foto va yozishmalar']
    contact = 'Shartnoma tomoni; nizo turi bo‘yicha fuqarolik sudi yoki uy-joy masalalariga vakolatli idora.'
  } else if (/сифатсиз|sifatsiz|истеъмолчи|iste.molchi|товар|tovar|қайтар/i.test(text)) {
    scenario = 'Tovar yoki xizmat sifati bo‘yicha iste’molchi nizosi'
    docs = ['Xarid cheki yoki to‘lov dalili', 'Tovar va kafolat hujjatlari', 'Nuqsonni ko‘rsatuvchi foto yoki ekspert xulosasi', 'Sotuvchiga yuborilgan talab']
    contact = 'Sotuvchi yoki xizmat ko‘rsatuvchi; iste’molchilar huquqlarini himoya qiluvchi vakolatli organ yoki sud.'
  }

  const formattedSources = sources.map((article) => ({
    lawId: article.law_id,
    lawTitle: article.law_title,
    articleNumber: article.article_number,
    title: article.title,
    text: article.text,
    url: article.source_url,
    updatedAt: article.updated_at,
  }))

  return res.json({
    answer: {
      title: scenario,
      law: [...new Set(sources.map((source) => source.law_title))].join(', '),
      summary: 'Quyidagi moddalar faqat import qilingan LexUZ matnlaridan topildi. Ularning vaziyatingizga tatbiqini moddaning to‘liq matni va faktlar bilan tekshiring.',
      rules: formattedSources.map((source) => `${source.lawTitle}, ${source.articleNumber}-modda. ${source.title}`),
      steps,
      docs,
      deadlines: 'Tegishli moddalarda sud yoki shikoyat uchun aniq muddat aniqlanmadi. Vaziyatga tatbiq etiladigan LexUZ normasidan muddatni alohida tekshiring.',
      sampleApplication: [
        'Kimga: [vakolatli tashkilot yoki shaxs]',
        'Kimdan: [F.I.Sh., aloqa ma’lumotlari]',
        '',
        'ARIZA / TALABNOMA',
        '',
        `Men, [F.I.Sh.], [sana] kuni yuz bergan "${scenario}" holati bo‘yicha murojaat qilaman.`,
        '[Hodisalar va dalillarni sanalar bilan yozing. Talabni aniq ko‘rsating.]',
        '',
        'Ilovalar: [dalillar va hujjatlar ro‘yxati]',
        'Sana: [sana]    Imzo: [imzo]',
      ].join('\n'),
      caution: 'Bu umumiy ma’lumot; murakkab holatda advokatga murojaat qiling. Sud va shikoyat muddatlari vaziyatga qarab farq qiladi; manbada aniq ko‘rsatilmagan muddat taxmin qilinmaydi.',
      contact,
      sources: formattedSources,
    },
  })
})

app.get('/api/legal/saved', authMiddleware, async (req, res) => {
  const articles = await all(
    `SELECT a.id, a.law_id, d.title AS law_title, a.article_number, a.title,
            a.source_url, a.source_anchor, s.created_at
     FROM saved_articles s
     JOIN legal_articles a ON a.id = s.article_id
     JOIN legal_documents d ON d.id = a.law_id
     WHERE s.user_id = ? ORDER BY s.created_at DESC`,
    [req.user.id],
  )
  return res.json({ articles })
})

app.post('/api/legal/saved', authMiddleware, async (req, res) => {
  const articleId = Number.parseInt(req.body.articleId, 10)
  if (!Number.isSafeInteger(articleId) || articleId < 1) return res.status(400).json({ message: 'Modda identifikatori noto‘g‘ri.' })
  const article = await get('SELECT id FROM legal_articles WHERE id = ?', [articleId])
  if (!article) return res.status(404).json({ message: 'Import qilingan modda topilmadi.' })
  await run('INSERT OR IGNORE INTO saved_articles (user_id, article_id) VALUES (?, ?)', [req.user.id, articleId])
  return res.status(201).json({ ok: true })
})

app.delete('/api/legal/saved/:articleId', authMiddleware, async (req, res) => {
  await run('DELETE FROM saved_articles WHERE user_id = ? AND article_id = ?', [req.user.id, req.params.articleId])
  return res.json({ ok: true })
})

app.get('/api/legal/history', authMiddleware, async (req, res) => {
  const history = await all(
    'SELECT id, query, area, created_at FROM legal_search_history WHERE user_id = ? ORDER BY created_at DESC LIMIT 50',
    [req.user.id],
  )
  return res.json({ history })
})

app.post('/api/legal/history', authMiddleware, async (req, res) => {
  const query = normalizeLegalQuery(String(req.body.query || ''))
  const area = String(req.body.area || '').slice(0, 40)
  if (query.length < 2 || query.length > 160) return res.status(400).json({ message: 'Qidiruv so‘rovi noto‘g‘ri.' })
  await run('INSERT INTO legal_search_history (user_id, query, area) VALUES (?, ?, ?)', [req.user.id, query, area])
  return res.status(201).json({ ok: true })
})

app.post('/api/register', async (req, res) => {
  const name = academyText(req.body.name, 80)
  const email = academyText(req.body.email, 160).toLocaleLowerCase('en-US')
  const { password } = req.body

  if (!name || !email || !password) {
    return res.status(400).json({ message: 'Name, email va password majburiy' })
  }
  if (String(password).length < 8) {
    return res.status(400).json({ message: 'Parol kamida 8 belgidan iborat bo‘lishi kerak.' })
  }

  try {
    const passwordHash = await bcrypt.hash(password, 10)
    const user = await run(
      'INSERT INTO users (name, email, password_hash, role) VALUES (?, ?, ?, ?)',
      [name, email, passwordHash, 'foydalanuvchi'],
    )

    const token = jwt.sign({ id: user.id, email, name }, JWT_SECRET, { expiresIn: '7d' })

    return res.status(201).json({
      token,
      user: { id: user.id, name, email, role: 'foydalanuvchi' },
    })
  } catch (error) {
    if (error.code === 'SQLITE_CONSTRAINT_UNIQUE') {
      return res.status(409).json({ message: 'Bu email allaqachon ro‘yxatdan o‘tgan' })
    }

    return res.status(500).json({ message: 'Ro‘yxatdan o‘tishda xatolik', error: error.message })
  }
})

app.post('/api/login', async (req, res) => {
  const email = academyText(req.body.email, 160).toLocaleLowerCase('en-US')
  const { password } = req.body

  if (!email || !password) {
    return res.status(400).json({ message: 'Email va password kiriting' })
  }

  try {
    const user = await get('SELECT * FROM users WHERE email = ?', [email])

    if (!user) {
      return res.status(401).json({ message: 'Foydalanuvchi topilmadi' })
    }

    const valid = await bcrypt.compare(password, user.password_hash)

    if (!valid) {
      return res.status(401).json({ message: 'Parol noto‘g‘ri' })
    }

    const token = jwt.sign({ id: user.id, email: user.email, name: user.name }, JWT_SECRET, { expiresIn: '7d' })

    return res.json({
      token,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
      },
    })
  } catch (error) {
    return res.status(500).json({ message: 'Login xatosi', error: error.message })
  }
})

app.get('/api/profile', authMiddleware, async (req, res) => {
  const user = await get('SELECT id, name, email, role FROM users WHERE id = ?', [req.user.id])

  if (!user) {
    return res.status(404).json({ message: 'Foydalanuvchi topilmadi' })
  }

  return res.json({ user })
})

app.get('/api/chats', authMiddleware, async (req, res) => {
  const chats = await all(
    'SELECT * FROM chats WHERE user_id = ? ORDER BY created_at DESC LIMIT 30',
    [req.user.id],
  )

  return res.json({ chats })
})

app.post('/api/chats', authMiddleware, async (req, res) => {
  const { question, answer } = req.body

  if (!question || !answer) {
    return res.status(400).json({ message: 'Question va answer kerak' })
  }

  const saved = await run('INSERT INTO chats (user_id, question, answer) VALUES (?, ?, ?)', [
    req.user.id,
    question,
    JSON.stringify(answer),
  ])

  return res.status(201).json({ id: saved.id, question, answer })
})

app.get('/api/documents', authMiddleware, async (req, res) => {
  const docs = await all(
    'SELECT * FROM documents WHERE user_id = ? ORDER BY created_at DESC',
    [req.user.id],
  )

  return res.json({ documents: docs })
})

app.post('/api/documents', authMiddleware, async (req, res) => {
  const { title, type, status, content } = req.body

  if (!title || !type) {
    return res.status(400).json({ message: 'Title va type kerak' })
  }

  const saved = await run(
    'INSERT INTO documents (user_id, title, type, status, content) VALUES (?, ?, ?, ?, ?)',
    [req.user.id, title, type, status || 'Yaratildi', content || ''],
  )

  return res.status(201).json({ doc: { id: saved.id, title, type, status, content } })
})

app.delete('/api/documents/:id', authMiddleware, async (req, res) => {
  await run('DELETE FROM documents WHERE id = ? AND user_id = ?', [req.params.id, req.user.id])
  return res.json({ ok: true })
})

export const startServer = async ({
  port = PORT,
  host,
  databasePath = process.env.DATABASE_PATH || path.join(__dirname, 'database.db'),
} = {}) => {
  db = new sqlite3.Database(databasePath)
  await initializeDb()
  await runMigrations(db)

  return new Promise((resolve, reject) => {
    const server = host ? app.listen(port, host) : app.listen(port)
    server.once('error', reject)
    server.once('listening', () => resolve(server))
    server.once('close', () => {
      db.close((error) => {
        if (error) console.error('Database close failed:', error)
      })
    })
  })
}

if (process.argv[1] && path.resolve(process.argv[1]) === __filename) {
  startServer()
    .then((server) => {
      const address = server.address()
      console.log(`Server running on http://localhost:${typeof address === 'object' ? address.port : PORT}`)
    })
    .catch((error) => {
      console.error('Server failed to start:', error)
      process.exitCode = 1
    })
}

export default app

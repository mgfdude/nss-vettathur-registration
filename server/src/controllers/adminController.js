const db = require('../../../database/connection');
const { sendMail } = require('../utils/email');

const statusEmailTemplates = {
  'Under Review': {
    template: 'under-review.html',
    subject: 'NSS Vettathur Application Under Review'
  },
  'Interview Scheduled': {
    template: 'interview-scheduled.html',
    subject: 'NSS Vettathur Interview Scheduled'
  },
  Selected: {
    template: 'selected.html',
    subject: 'Congratulations! Selected for NSS Vettathur'
  },
  Rejected: {
    template: 'not-selected.html',
    subject: 'NSS Vettathur Selection Result'
  },
  Waitlisted: {
    template: 'waitlisted.html',
    subject: 'NSS Vettathur Application Waitlisted'
  }
};

async function getApplications(req, res) {
  try {
    const { search, status, sortField, sortOrder, page = 1, limit = 10 } = req.query;

    let query = db('applications')
      .join('users', 'applications.user_id', 'users.id')
      .select(
        'applications.*',
        'users.app_id',
        'users.email',
        'users.phone'
      );

    if (status) {
      query = query.where('applications.status', status);
    }

    if (search) {
      query = query.andWhere((qb) => {
        qb.whereLike('users.app_id', `%${search}%`)
          .orWhereLike('applications.full_name', `%${search}%`)
          .orWhereLike('applications.first_name', `%${search}%`)
          .orWhereLike('applications.last_name', `%${search}%`)
          .orWhereLike('users.email', `%${search}%`);
      });
    }

    const field = sortField || 'applications.created_at';
    const order = sortOrder || 'desc';
    query = query.orderBy(field, order);

    // Pagination
    const offset = (page - 1) * limit;
    const totalCountResult = await query.clone().count('applications.id as count').first();
    const total = totalCountResult ? totalCountResult.count : 0;

    const items = await query.limit(limit).offset(offset);

    res.json({
      items,
      total,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10)
    });
  } catch (error) {
    console.error('Admin get applications error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getApplicationById(req, res) {
  try {
    const { id } = req.params;
    const app = await db('applications')
      .join('users', 'applications.user_id', 'users.id')
      .select('applications.*', 'users.app_id', 'users.email', 'users.phone')
      .where('applications.id', id)
      .first();

    if (!app) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    res.json(app);
  } catch (error) {
    console.error('Admin get app by ID error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function updateApplicationStatus(req, res) {
  try {
    const { id } = req.params;
    const { status, interview_marks, admin_remarks } = req.body;

    const app = await db('applications').where({ id }).first();
    if (!app) {
      return res.status(404).json({ error: 'Application not found.' });
    }

    const user = await db('users').where({ id: app.user_id }).first();

    const updates = {};
    if (status !== undefined) updates.status = status;
    if (interview_marks !== undefined) updates.interview_marks = interview_marks;
    if (admin_remarks !== undefined) updates.admin_remarks = admin_remarks;
    updates.updated_at = new Date();

    await db('applications').where({ id }).update(updates);

    // Create notifications for students on status change
    if (status) {
      await db('notifications').insert({
        user_id: app.user_id,
        title: `Status Update: ${status}`,
        message: `Your application status has been updated to "${status}".`
      });

      const statusMail = statusEmailTemplates[status];
      if (statusMail) {
        try {
          const studentName = app.full_name || `${app.first_name || ''} ${app.last_name || ''}`.trim() || 'Student';
          await sendMail(user.email, statusMail.subject, statusMail.template, {
            STUDENT_NAME: studentName,
            APP_ID: user.app_id,
            BATCH: app.class_name || 'NSS Vettathur',
            SELECTION_STATUS: status === 'Rejected' ? 'Not Selected' : status
          });
        } catch (mailErr) {
          console.error('Failed to send status email:', mailErr);
        }
      }
    }

    res.json({ message: 'Application updated successfully.' });
  } catch (error) {
    console.error('Admin update status error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getStats(req, res) {
  try {
    const counts = await db('applications')
      .select('status')
      .count('id as count')
      .groupBy('status');

    const totalUsers = await db('users')
      .where({ role: 'student' })
      .count('id as count')
      .first();

    const stats = {
      totalStudents: totalUsers ? totalUsers.count : 0,
      Draft: 0,
      Submitted: 0,
      'Under Review': 0,
      'Interview Scheduled': 0,
      Selected: 0,
      Rejected: 0,
      Waitlisted: 0
    };

    counts.forEach((row) => {
      stats[row.status] = row.count;
    });

    res.json(stats);
  } catch (error) {
    console.error('Admin get stats error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getSettings(req, res) {
  try {
    const rows = await db('settings').select('*');
    const settings = {};
    rows.forEach(r => {
      settings[r.key] = r.value;
    });
    res.json(settings);
  } catch (error) {
    console.error('Admin get settings error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function updateSettings(req, res) {
  try {
    const updates = req.body; // Key-value object
    const now = new Date();
    for (const [key, value] of Object.entries(updates)) {
      const existing = await db('settings').where({ key }).first();
      if (existing) {
        await db('settings').where({ key }).update({
          value: String(value),
          updated_at: now
        });
      } else {
        await db('settings').insert({
          key,
          value: String(value),
          description: `Admin setting: ${key}`,
          created_at: now,
          updated_at: now
        });
      }
    }
    res.json({ message: 'Settings updated successfully.' });
  } catch (error) {
    console.error('Admin update settings error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function getAnnouncements(req, res) {
  try {
    const items = await db('announcements')
      .orderBy([
        { column: 'sort_order', order: 'asc' },
        { column: 'published_at', order: 'desc' }
      ]);
    res.json({ items });
  } catch (error) {
    console.error('Admin get announcements error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function createAnnouncement(req, res) {
  try {
    const { title, body, is_published = true, sort_order = 0 } = req.body;
    if (!title || !body) {
      return res.status(400).json({ error: 'Title and body are required.' });
    }

    const [id] = await db('announcements').insert({
      title: String(title).trim(),
      body: String(body).trim(),
      is_published: Boolean(is_published),
      sort_order: parseInt(sort_order, 10) || 0,
      published_at: new Date(),
      created_at: new Date(),
      updated_at: new Date()
    });

    const item = await db('announcements').where({ id }).first();
    res.status(201).json({ message: 'Announcement created.', item });
  } catch (error) {
    console.error('Admin create announcement error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function updateAnnouncement(req, res) {
  try {
    const { id } = req.params;
    const existing = await db('announcements').where({ id }).first();
    if (!existing) {
      return res.status(404).json({ error: 'Announcement not found.' });
    }

    const updates = { updated_at: new Date() };
    if (req.body.title !== undefined) updates.title = String(req.body.title).trim();
    if (req.body.body !== undefined) updates.body = String(req.body.body).trim();
    if (req.body.is_published !== undefined) updates.is_published = Boolean(req.body.is_published);
    if (req.body.sort_order !== undefined) updates.sort_order = parseInt(req.body.sort_order, 10) || 0;

    await db('announcements').where({ id }).update(updates);
    const item = await db('announcements').where({ id }).first();
    res.json({ message: 'Announcement updated.', item });
  } catch (error) {
    console.error('Admin update announcement error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

async function deleteAnnouncement(req, res) {
  try {
    const { id } = req.params;
    const deleted = await db('announcements').where({ id }).del();
    if (!deleted) {
      return res.status(404).json({ error: 'Announcement not found.' });
    }
    res.json({ message: 'Announcement deleted.' });
  } catch (error) {
    console.error('Admin delete announcement error:', error);
    res.status(500).json({ error: 'Internal server error.' });
  }
}

module.exports = {
  getApplications,
  getApplicationById,
  updateApplicationStatus,
  getStats,
  getSettings,
  updateSettings,
  getAnnouncements,
  createAnnouncement,
  updateAnnouncement,
  deleteAnnouncement
};

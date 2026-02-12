export const mapUser = (row) => {
  if (!row) return null;

  return {
    id: row.id,
    email: row.email,
    invitationCode: row.invitation_code || '',
    boundInvitationCode: row.bound_invitation_code || '',
    emailVerified: Boolean(row.email_verified),
    createdAt: row.created_at,
    name: row.name || '',
    avatar: row.avatar || '',
    gender: row.gender || 'male',
    partnerId: row.partner_id || null,
  };
};

const mapAuthor = (authorRow) => {
  if (!authorRow) return null;
  return {
    id: authorRow.id,
    name: authorRow.name || '',
    email: authorRow.email || '',
    avatar: authorRow.avatar || '',
    gender: authorRow.gender || 'male',
  };
};

export const mapMemory = (row, authorRow = null) => ({
  id: row.id,
  title: row.title,
  date: row.date,
  image: row.image,
  rotation: row.rotation || '',
  userId: row.user_id || '',
  author: mapAuthor(authorRow),
});

export const mapEvent = (row, authorRow = null) => ({
  id: row.id,
  title: row.title,
  subtitle: row.subtitle || '',
  date: row.date,
  type: row.type,
  image: row.image || '',
  userId: row.user_id || '',
  author: mapAuthor(authorRow),
});

export const mapNotification = (row) => ({
  id: row.id,
  userId: row.user_id,
  title: row.title,
  message: row.message,
  type: row.type,
  read: Boolean(row.read),
  createdAt: row.created_at,
});

export const mapSettings = (settingsRow, userRow) => ({
  togetherDate: settingsRow?.together_date || null,
  isConnected: Boolean(settingsRow?.is_connected),
  inviteCode: userRow?.invitation_code || null,
  boundInviteCode: userRow?.bound_invitation_code || null,
});

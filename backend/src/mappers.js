import { config } from './config.js';

export const normalizeAvatar = (avatar) => {
  const value = typeof avatar === 'string' ? avatar : '';
  if (!value) return '';
  if (!value.startsWith('data:')) return value;
  if (value.length <= config.maxAvatarLength) return value;
  return '';
};

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
    avatar: normalizeAvatar(row.avatar),
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
    avatar: normalizeAvatar(authorRow.avatar),
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

const LEGACY_NOTIFICATION_TITLE_MAP = {
  'Binding confirmed': '绑定已确认',
  'Binding completed': '绑定成功',
  'Binding request rejected': '绑定请求被拒绝',
  'Connect request sent': '绑定请求已发送',
  'Pending binding request': '待处理的绑定请求',
  'Relationship disconnected': '关系已解除',
  Disconnected: '已解除绑定',
};

const localizeLegacyNotificationMessage = (message = '') => {
  if (!message) return '';

  const directMap = {
    'You have disconnected the current relationship.': '你已解除当前绑定关系。',
  };

  if (directMap[message]) return directMap[message];

  const accepted = message.match(/^(.+) accepted your binding request\.$/);
  if (accepted) return `${accepted[1]} 已同意你的绑定请求。`;

  const rejected = message.match(/^(.+) rejected your binding request\.$/);
  if (rejected) return `${rejected[1]} 已拒绝你的绑定请求。`;

  const connected = message.match(/^You have connected with (.+)\.$/);
  if (connected) return `你已与 ${connected[1]} 完成绑定。`;

  const sent = message.match(/^A binding request has been sent to (.+)\.$/);
  if (sent) return `已向 ${sent[1]} 发送绑定请求。`;

  const pending = message.match(
    /^(.+) wants to connect with you\. Open the Relationship page to accept or reject\.$/
  );
  if (pending) return `${pending[1]} 想与你绑定，请在关系页面同意或拒绝。`;

  const disconnected = message.match(/^(.+) removed the binding relationship\.$/);
  if (disconnected) return `${disconnected[1]} 解除了绑定关系。`;

  return message;
};

export const mapNotification = (row) => ({
  id: row.id,
  userId: row.user_id,
  title: LEGACY_NOTIFICATION_TITLE_MAP[row.title] || row.title,
  message: localizeLegacyNotificationMessage(row.message),
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

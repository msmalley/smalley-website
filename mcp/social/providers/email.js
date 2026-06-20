import { ImapFlow } from 'imapflow';
import { createTransport } from 'nodemailer';
import { simpleParser } from 'mailparser';

function getAccounts() {
  const accounts = [];
  for (let i = 1; i <= 10; i++) {
    const address = process.env[`EMAIL_${i}_ADDRESS`];
    const password = process.env[`EMAIL_${i}_PASSWORD`];
    if (address && password) {
      accounts.push({ address, password });
    }
  }
  if (!accounts.length) {
    throw new Error(
      'No email accounts configured. Add to .env:\n' +
      '  EMAIL_1_ADDRESS=you@domain.com\n' +
      '  EMAIL_1_PASSWORD=xxxx xxxx xxxx xxxx\n' +
      'Generate App Password: myaccount.google.com/apppasswords (2FA required)'
    );
  }
  return accounts;
}

function resolveAccount(accountHint) {
  const accounts = getAccounts();
  if (!accountHint) return accounts[0];

  const match = accounts.find(a =>
    a.address === accountHint ||
    a.address.includes(accountHint) ||
    accountHint.includes(a.address.split('@')[1])
  );
  if (!match) {
    throw new Error(
      `Account "${accountHint}" not found. Available: ${accounts.map(a => a.address).join(', ')}`
    );
  }
  return match;
}

async function connect(account) {
  const client = new ImapFlow({
    host: 'imap.gmail.com',
    port: 993,
    secure: true,
    auth: {
      user: account.address,
      pass: account.password
    },
    logger: false
  });

  try {
    await client.connect();
  } catch (err) {
    if (err.message?.includes('AUTHENTICATIONFAILED')) {
      throw new Error(
        `Gmail auth failed for ${account.address}. Check:\n` +
        '1. App Password is correct (not your regular password)\n' +
        '2. IMAP is enabled: Gmail → Settings → Forwarding/IMAP → Enable IMAP\n' +
        '3. 2FA is enabled on the Google account'
      );
    }
    throw err;
  }

  return client;
}

export async function listInbox(accountHint, limit = 20, unreadOnly = false) {
  const account = resolveAccount(accountHint);
  const client = await connect(account);

  try {
    await client.mailboxOpen('INBOX');

    const criteria = unreadOnly ? { seen: false } : { all: true };
    const uids = await client.search(criteria, { uid: true });

    const recentUids = uids.slice(-limit).reverse();

    if (!recentUids.length) {
      return { account: account.address, messages: [], total: 0 };
    }

    const messages = [];
    for await (const msg of client.fetch(recentUids, {
      uid: true,
      envelope: true,
      flags: true
    }, { uid: true })) {
      messages.push({
        uid: msg.uid,
        from: msg.envelope.from?.[0]?.address || 'unknown',
        fromName: msg.envelope.from?.[0]?.name || null,
        subject: msg.envelope.subject || '(no subject)',
        date: msg.envelope.date?.toISOString() || null,
        unread: !msg.flags.has('\\Seen')
      });
    }

    return {
      account: account.address,
      total: uids.length,
      showing: messages.length,
      messages
    };
  } finally {
    await client.logout();
  }
}

export async function searchMessages(accountHint, criteria = {}) {
  const account = resolveAccount(accountHint);
  const client = await connect(account);

  try {
    const folder = criteria.folder || 'INBOX';
    await client.mailboxOpen(folder);

    const searchCriteria = {};
    if (criteria.from) searchCriteria.from = criteria.from;
    if (criteria.subject) searchCriteria.subject = criteria.subject;
    if (criteria.since) searchCriteria.since = criteria.since;
    if (criteria.before) searchCriteria.before = criteria.before;
    if (criteria.unread_only) searchCriteria.seen = false;
    if (criteria.text) searchCriteria.body = criteria.text;

    if (!Object.keys(searchCriteria).length) searchCriteria.all = true;

    const uids = await client.search(searchCriteria, { uid: true });
    const recentUids = uids.slice(-(criteria.limit || 20)).reverse();

    if (!recentUids.length) {
      return { account: account.address, folder, messages: [], total: 0 };
    }

    const messages = [];
    for await (const msg of client.fetch(recentUids, {
      uid: true,
      envelope: true,
      flags: true
    }, { uid: true })) {
      messages.push({
        uid: msg.uid,
        from: msg.envelope.from?.[0]?.address || 'unknown',
        fromName: msg.envelope.from?.[0]?.name || null,
        subject: msg.envelope.subject || '(no subject)',
        date: msg.envelope.date?.toISOString() || null,
        unread: !msg.flags.has('\\Seen')
      });
    }

    return {
      account: account.address,
      folder,
      total: uids.length,
      showing: messages.length,
      messages
    };
  } finally {
    await client.logout();
  }
}

export async function readMessage(accountHint, uid, folder = 'INBOX') {
  const account = resolveAccount(accountHint);
  const client = await connect(account);

  try {
    await client.mailboxOpen(folder);

    const rawSource = await client.download(uid.toString(), undefined, { uid: true });
    if (!rawSource?.content) {
      throw new Error(`Message UID ${uid} not found in ${folder}`);
    }

    const parsed = await simpleParser(rawSource.content);

    return {
      account: account.address,
      uid,
      from: parsed.from?.text || 'unknown',
      to: parsed.to?.text || 'unknown',
      subject: parsed.subject || '(no subject)',
      date: parsed.date?.toISOString() || null,
      body: parsed.text || parsed.html?.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim() || '(no body)',
      hasAttachments: (parsed.attachments?.length || 0) > 0,
      attachments: parsed.attachments?.map(a => ({ filename: a.filename, size: a.size })) || [],
      messageId: parsed.messageId || null,
      inReplyTo: parsed.inReplyTo || null,
      references: parsed.references || null
    };
  } finally {
    await client.logout();
  }
}

export async function archiveMessages(accountHint, uids) {
  const account = resolveAccount(accountHint);
  const client = await connect(account);

  try {
    await client.mailboxOpen('INBOX');

    const uidList = Array.isArray(uids) ? uids.map(String) : [String(uids)];
    const result = await client.messageMove(uidList.join(','), '[Gmail]/All Mail', { uid: true });

    return {
      success: true,
      account: account.address,
      archived: uidList.length,
      uids: uidList
    };
  } finally {
    await client.logout();
  }
}

export async function trashMessages(accountHint, uids) {
  const account = resolveAccount(accountHint);
  const client = await connect(account);

  try {
    await client.mailboxOpen('INBOX');

    const uidList = Array.isArray(uids) ? uids.map(String) : [String(uids)];
    await client.messageMove(uidList.join(','), '[Gmail]/Trash', { uid: true });

    return {
      success: true,
      account: account.address,
      trashed: uidList.length,
      uids: uidList
    };
  } finally {
    await client.logout();
  }
}


export async function replyToMessage(accountHint, uid, body, replyAll = false) {
  const account = resolveAccount(accountHint);

  const original = await readMessage(accountHint, uid);

  const transporter = createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: account.address,
      pass: account.password
    }
  });

  const to = replyAll ? original.to : original.from;
  const subject = original.subject.startsWith('Re:')
    ? original.subject
    : `Re: ${original.subject}`;

  const headers = {};
  if (original.messageId) {
    headers['In-Reply-To'] = original.messageId;
    headers['References'] = [
      ...(original.references || []),
      original.messageId
    ].join(' ');
  }

  const result = await transporter.sendMail({
    from: account.address,
    to,
    subject,
    text: body,
    headers
  });

  return {
    success: true,
    account: account.address,
    to,
    subject,
    messageId: result.messageId
  };
}

export async function sendEmail(accountHint, to, subject, body, attachments) {
  const account = resolveAccount(accountHint);

  const transporter = createTransport({
    host: 'smtp.gmail.com',
    port: 587,
    secure: false,
    auth: {
      user: account.address,
      pass: account.password
    }
  });

  const mailOptions = {
    from: account.address,
    to,
    subject,
    text: body
  };

  if (attachments && attachments.length > 0) {
    const { readFileSync } = await import('fs');
    const { basename } = await import('path');
    mailOptions.attachments = attachments.map(filePath => ({
      filename: basename(filePath),
      content: readFileSync(filePath)
    }));
  }

  const result = await transporter.sendMail(mailOptions);

  return {
    success: true,
    account: account.address,
    to,
    subject,
    messageId: result.messageId,
    attachments: attachments ? attachments.length : 0
  };
}

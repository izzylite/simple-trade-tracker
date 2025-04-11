import * as functions from 'firebase-functions';
import * as admin from 'firebase-admin';
import { google } from 'googleapis';
import * as Busboy from 'busboy';
import * as os from 'os';
import * as path from 'path';
import * as fs from 'fs';

admin.initializeApp();

const SCOPES = ['https://www.googleapis.com/auth/drive.file'];

// Initialize the Google Drive API
const auth = new google.auth.GoogleAuth({
  credentials: JSON.parse(process.env.GOOGLE_APPLICATION_CREDENTIALS || '{}'),
  scopes: SCOPES,
});

const drive = google.drive({ version: 'v3', auth });

export const uploadToDrive = functions.https.onRequest(async (req, res) => {
  // Handle CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'POST');
  res.set('Access-Control-Allow-Headers', 'Authorization, Content-Type');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'POST') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Verify Firebase Auth token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).send('Unauthorized');
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    res.status(401).send('Unauthorized');
    return;
  }

  const busboy = Busboy({ headers: req.headers });
  const tmpdir = os.tmpdir();
  const uploads: { [fieldname: string]: string } = {};
  const fileWrites: Promise<void>[] = [];

  busboy.on('file', (fieldname, file, info) => {
    const { filename, mimeType } = info;
    const filepath = path.join(tmpdir, filename);
    uploads[fieldname] = filepath;

    const writeStream = fs.createWriteStream(filepath);
    file.pipe(writeStream);

    const promise = new Promise<void>((resolve, reject) => {
      file.on('end', () => writeStream.end());
      writeStream.on('finish', resolve);
      writeStream.on('error', reject);
    });

    fileWrites.push(promise);
  });

  busboy.on('finish', async () => {
    await Promise.all(fileWrites);

    const file = uploads['file'];
    if (!file) {
      res.status(400).send('No file uploaded');
      return;
    }

    try {
      const response = await drive.files.create({
        requestBody: {
          name: path.basename(file),
          mimeType: 'image/jpeg',
        },
        media: {
          mimeType: 'image/jpeg',
          body: fs.createReadStream(file),
        },
        fields: 'id, name, webViewLink',
      });

      // Clean up the temporary file
      fs.unlinkSync(file);

      res.status(200).json({
        id: response.data.id,
        name: response.data.name,
        webViewLink: response.data.webViewLink,
      });
    } catch (error) {
      console.error('Error uploading to Drive:', error);
      res.status(500).send('Error uploading file');
    }
  });

  busboy.end(req.rawBody);
});

export const deleteFromDrive = functions.https.onRequest(async (req, res) => {
  // Handle CORS
  res.set('Access-Control-Allow-Origin', '*');
  res.set('Access-Control-Allow-Methods', 'DELETE');
  res.set('Access-Control-Allow-Headers', 'Authorization');

  if (req.method === 'OPTIONS') {
    res.status(204).send('');
    return;
  }

  if (req.method !== 'DELETE') {
    res.status(405).send('Method Not Allowed');
    return;
  }

  // Verify Firebase Auth token
  const authHeader = req.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    res.status(401).send('Unauthorized');
    return;
  }

  const idToken = authHeader.split('Bearer ')[1];
  try {
    await admin.auth().verifyIdToken(idToken);
  } catch (error) {
    res.status(401).send('Unauthorized');
    return;
  }

  const fileId = req.path.split('/').pop();
  if (!fileId) {
    res.status(400).send('No file ID provided');
    return;
  }

  try {
    await drive.files.delete({
      fileId: fileId,
    });
    res.status(200).send('File deleted successfully');
  } catch (error) {
    console.error('Error deleting from Drive:', error);
    res.status(500).send('Error deleting file');
  }
}); 
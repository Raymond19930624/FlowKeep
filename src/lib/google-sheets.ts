
import { GoogleSpreadsheet } from 'google-spreadsheet';
import { JWT } from 'google-auth-library';
import type { GoogleSpreadsheet as GoogleSpreadsheetType, GoogleSpreadsheetWorksheet } from 'google-spreadsheet';

let doc: GoogleSpreadsheetType | null = null;
let docLoaded = false;
let credsValid: boolean | undefined = undefined;

function checkCreds(): boolean {
  if (credsValid !== undefined) return credsValid;

  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID;
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY;
  
  credsValid = !!(SPREADSHEET_ID && GOOGLE_SERVICE_ACCOUNT_EMAIL && GOOGLE_PRIVATE_KEY);
  return credsValid;
}

async function getDocInstance(): Promise<GoogleSpreadsheetType | null> {
  if (!checkCreds()) {
    console.warn("Build Warning: Google Sheets credentials not found. This is expected during the build process. API calls will be skipped.");
    return null;
  }

  if (doc) return doc;

  const SPREADSHEET_ID = process.env.GOOGLE_SHEET_ID!;
  const GOOGLE_SERVICE_ACCOUNT_EMAIL = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL!;
  const GOOGLE_PRIVATE_KEY = process.env.GOOGLE_PRIVATE_KEY!;

  try {
    const serviceAccountAuth = new JWT({
      email: GOOGLE_SERVICE_ACCOUNT_EMAIL,
      key: GOOGLE_PRIVATE_KEY.replace(/\\n/g, '\n'),
      scopes: [
        'https://www.googleapis.com/auth/spreadsheets',
      ],
    });
    doc = new GoogleSpreadsheet(SPREADSHEET_ID, serviceAccountAuth);
    return doc;
  } catch (e) {
    console.error("Failed to initialize GoogleSpreadsheet:", e);
    return null;
  }
}

async function loadDocInfo(): Promise<void> {
  if (docLoaded) return;
  const sheetDoc = await getDocInstance();
  if (!sheetDoc) return; 

  try {
    await sheetDoc.loadInfo();
    docLoaded = true;
  } catch (error) {
    console.error("Error loading Google Sheet document info:", error);
    if (error instanceof Error && (error as any).response?.status === 403) {
       throw new Error("無法存取 Google Sheet。請確認服務帳戶的 email 已被分享至您的 Google Sheet 並給予「編輯者」權限。");
    }
    throw new Error("載入 Google Sheet 文件時發生錯誤，請檢查您的憑證是否正確。");
  }
}

async function getSheet(title: string): Promise<GoogleSpreadsheetWorksheet | null> {
    const sheetDoc = await getDocInstance();
    if (!sheetDoc) return null;
    
    // loadDocInfo is idempotent and will only run once
    await loadDocInfo();
    if (!docLoaded) return null;

    const sheet = sheetDoc.sheetsByTitle[title];
    if (!sheet) {
        console.error(`In your Google Sheet, a worksheet named '${title}' was not found.`);
        return null;
    }
    return sheet;
}

export async function getProjectsSheet(): Promise<GoogleSpreadsheetWorksheet | null> {
  return getSheet('Projects');
}

export async function getTransactionsSheet(): Promise<GoogleSpreadsheetWorksheet | null> {
  return getSheet('Transactions');
}

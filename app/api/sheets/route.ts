import { NextResponse } from 'next/server';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbyxJdtAIOTfL_xhe75yy9OOOAr9oQ1xRdztZDeZGxyvvxh6-tPFtehUiIe34fP2EqlD/exec';

export async function GET() {
  try {
    const res = await fetch(APPS_SCRIPT_URL, { cache: 'no-store' });
    if (!res.ok) return NextResponse.json({ error: 'Fetch failed' }, { status: 500 });
    const data = await res.json();
    return NextResponse.json(data);
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}

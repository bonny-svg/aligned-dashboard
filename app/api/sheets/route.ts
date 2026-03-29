import { NextResponse } from 'next/server';

const APPS_SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbwPWNLHRNe476OQF5YcWb6TD_6oM7tPN1t5PPKDV-lQtFDwantuxCETEn8uGHxthy-w/exec';

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

import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const body = await req.json();
    // 여기서는 디자인이 아니라 데이터만 처리합니다.
    return NextResponse.json({ success: true, data: body });
  } catch (error) {
    return NextResponse.json({ error: "데이터 처리 중 오류 발생" }, { status: 500 });
  }
}

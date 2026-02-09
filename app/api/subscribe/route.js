export async function POST(request) {
  const { email } = await request.json();
  if (!email) {
    return Response.json({ ok: false, error: "Missing email" }, { status: 400 });
  }
  return Response.json({ ok: true });
}

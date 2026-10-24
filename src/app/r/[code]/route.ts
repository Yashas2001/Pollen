// Tracked link: log the click, then send them to the product with UTM tags.
// STUB: Teammate B replaces this.
export async function GET(request: Request, { params }: { params: Promise<{ code: string }> }) {
  await params;
  return Response.redirect(new URL("/", request.url), 302);
}

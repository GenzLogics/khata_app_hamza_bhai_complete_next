import { NextResponse } from "next/server";

export function ok<T>(data: T, status = 200) {
  return NextResponse.json(data, { status });
}

export function badRequest(message: string) {
  return NextResponse.json({ detail: message }, { status: 400 });
}

export function unauthorized(message = "Not authenticated") {
  return NextResponse.json({ detail: message }, { status: 401 });
}

export function forbidden(message = "Forbidden") {
  return NextResponse.json({ detail: message }, { status: 403 });
}

export function notFound(message = "Not found") {
  return NextResponse.json({ detail: message }, { status: 404 });
}

export function conflict(message: string) {
  return NextResponse.json({ detail: message }, { status: 409 });
}

export function serverError(message = "Internal server error") {
  return NextResponse.json({ detail: message }, { status: 500 });
}

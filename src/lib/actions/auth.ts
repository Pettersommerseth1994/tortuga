"use server"

import { AuthError } from "next-auth"

import { signIn, signOut } from "@/lib/auth"

export type ActionState = { error?: string }

export async function login(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  try {
    await signIn("credentials", {
      email: String(formData.get("email") ?? ""),
      password: String(formData.get("password") ?? ""),
      redirectTo: "/kamper",
    })
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "Feil e-post eller passord." }
    }
    // redirect() kaster internt i Next.js — la den passere.
    throw error
  }
  return {}
}

export async function logout() {
  await signOut({ redirectTo: "/login" })
}

"use client"

import { useActionState } from "react"
import { Loader2Icon } from "lucide-react"

import { login, type ActionState } from "@/lib/actions/auth"
import { Alert, AlertTitle } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

const initialState: ActionState = {}

export function LoginForm() {
  const [state, formAction, pending] = useActionState(login, initialState)

  return (
    <form action={formAction} className="flex flex-col gap-6">
      <div className="flex flex-col gap-2 text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Logg inn</h1>
        <p className="text-sm text-muted-foreground">
          Fyll inn e-post og passord for å fortsette.
        </p>
      </div>

      {state.error && (
        <Alert variant="destructive">
          <AlertTitle>{state.error}</AlertTitle>
        </Alert>
      )}

      <div className="grid gap-4">
        <div className="grid gap-2">
          <Label htmlFor="email">E-post</Label>
          <Input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            placeholder="deg@firma.no"
            required
          />
        </div>

        <div className="grid gap-2">
          <Label htmlFor="password">Passord</Label>
          <Input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
          />
        </div>

        <Button type="submit" disabled={pending} className="w-full">
          {pending && <Loader2Icon className="animate-spin" />}
          Logg inn
        </Button>
      </div>

    </form>
  )
}

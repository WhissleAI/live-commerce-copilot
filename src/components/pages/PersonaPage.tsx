/**
 * Persona — who the copilot is speaking as, and what it will not say.
 *
 * The seller profile answered this for one surface by accident: `about` and
 * `voice` came out of the catalog, and every reply was for a session, so nobody
 * had to ask whether a reply on Reddit should sound like a reply on air. It
 * should not. The same person writes shorter and flatter in a subreddit than
 * they talk on a live auction, and a copilot that does not know that is
 * recognisable as a copilot in about one sentence.
 *
 * Three things live here that live nowhere else:
 *
 *  · BOUNDARIES are not preferences. `never_claim` and `never_discuss` go into
 *    the guard policy as never-say rules, so they are enforced on the reply and
 *    not merely hoped for in the prompt. `must_disclose` is the opposite kind of
 *    rule — a thing that has to be SAID, in rooms where not saying it is the
 *    violation.
 *  · A REGISTER per surface: how long, how formal, emoji or not.
 *  · The learned VOICE CORPUS — the operator's own past sends. It is cited on a
 *    draft as a style reference and never as grounding, which is stated here
 *    rather than left to be inferred, because a corpus of your own sentences
 *    looks exactly like a corpus of facts.
 */

import { useCallback, useEffect, useMemo, useState } from "react";
import { AlertTriangle, PenLine, Plus, Save, Sparkles, Trash2 } from "lucide-react";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { timeAgo } from "@/lib/format";
import { SURFACE_IDS, SURFACE_LABEL, capabilitiesOf } from "@/lib/surfaces";
import type { Persona, PersonaRegister, PersonaView, SurfaceId, VoiceCorpusDoc } from "@/lib/types";
import { AppShell } from "@/components/app/AppShell";
import { Section } from "./PageShell";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui/kit";

/** What a persona is before anyone has written one. Not a fiction: every field
 *  is empty, and the page says so rather than showing invented copy. */
/** A server answer folded onto a complete shape. Every field the payload did
 *  not carry is empty rather than missing, so no editor reads `undefined`. */
export function mergePersona(p: Persona | null | undefined): Persona {
  const base = emptyPersona();
  return {
    ...base,
    ...(p ?? {}),
    boundaries: { ...base.boundaries, ...(p?.boundaries ?? {}) },
    registers: p?.registers ?? {},
  };
}

export function emptyPersona(): Persona {
  return {
    name: "",
    about: "",
    voice: "",
    boundaries: { never_claim: [], never_discuss: [], must_disclose: [] },
    disclosure: null,
    registers: {},
  };
}

const BOUNDARY_COPY: {
  key: keyof Persona["boundaries"];
  title: string;
  hint: string;
  placeholder: string;
}[] = [
  {
    key: "never_claim",
    title: "Never claim",
    hint: "Statements of fact the copilot will not make, whatever it retrieves. These become never-say rules on the guard policy, so they are checked on the reply rather than asked for in a prompt.",
    placeholder: "guaranteed authentic",
  },
  {
    key: "never_discuss",
    title: "Never discuss",
    hint: "Subjects it will not be drawn onto, even when asked directly. It abstains and says it is not the right person to answer.",
    placeholder: "another seller's pricing",
  },
  {
    key: "must_disclose",
    title: "Always say",
    hint: "The opposite kind of rule, and a different mechanism: these are not checked by a guard, they are written into what the copilot is asked to say. It will always say them — in a room where not saying something is the violation, that is the thing that keeps you inside the rules.",
    placeholder: "that this is a paid partnership",
  },
];

export function PersonaPage() {
  const [saved, setSaved] = useState<Persona | null>(null);
  const [draft, setDraft] = useState<Persona | null>(null);
  // Learned, not edited. It is kept apart from the draft for the same reason
  // the server keeps it off the persona row: a form that could PUT it back
  // would let this page overwrite an index it never read.
  const [voice, setVoice] = useState<PersonaView["voice"]>({ total: 0, docs: [] });
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [learning, setLearning] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const view = await api.persona();
      // Absent is an empty state, not a failure. A backend that has not shipped
      // the endpoint and an operator who has not written one are the same
      // screen: a form with nothing in it.
      const merged = mergePersona(view.persona);
      setSaved(merged);
      setDraft(structuredClone(merged));
      setVoice(view.voice);
      setError(null);
    } catch (e) {
      setError((e as Error).message);
      const blank = emptyPersona();
      setSaved(blank);
      setDraft(structuredClone(blank));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const dirty = useMemo(
    () => Boolean(draft && saved) && JSON.stringify(draft) !== JSON.stringify(saved),
    [draft, saved],
  );

  if (loading || !draft) {
    return (
      <AppShell section="persona" title="Persona" subtitle="reading your persona…">
        <div className="flex flex-col gap-3">
          <Skeleton className="h-[34px] w-2/3" />
          <Skeleton className="h-[120px]" />
          <Skeleton className="h-[120px]" />
        </div>
      </AppShell>
    );
  }

  const set = <K extends keyof Persona>(k: K, v: Persona[K]) => setDraft({ ...draft, [k]: v });

  const setBoundary = (k: keyof Persona["boundaries"], list: string[]) =>
    set("boundaries", { ...draft.boundaries, [k]: list });

  /**
   * Save only what changed.
   *
   * `PUT /api/persona` is a MERGE: a field it is not given is left alone. So
   * sending the whole object is not the safe thing it looks like — it is how a
   * tab that has been open since before someone else's edit quietly reverts it.
   * A diff of the top-level keys is the smallest true statement of what this
   * person just did.
   */
  const changed = (): Partial<Persona> => {
    if (!saved) return draft;
    const patch: Partial<Persona> = {};
    (Object.keys(draft) as (keyof Persona)[]).forEach((k) => {
      // `id` and `updatedAt` are the server's to write, not this form's.
      if (k === "updatedAt" || k === "id") return;
      if (JSON.stringify(draft[k]) !== JSON.stringify(saved[k])) {
        Object.assign(patch, { [k]: draft[k] });
      }
    });
    return patch;
  };

  const save = async () => {
    setBusy(true);
    setError(null);
    try {
      const patch = changed();
      const view = await api.savePersona(patch);
      // The PUT answers with the whole view. Fold it the same way the load
      // does, so a field the server normalised (a formality of 11 became 5)
      // lands back in the form rather than staying wrong on screen.
      const merged = mergePersona(view.persona ?? { ...draft });
      setSaved(merged);
      setDraft(structuredClone(merged));
      setVoice(view.voice);
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setBusy(false);
    }
  };

  const learn = async () => {
    setLearning(true);
    setError(null);
    setNote(null);
    try {
      const r = await api.learnPersona();
      // Re-learning the same history writes the same rows, so a second press
      // reports the same number rather than double. Saying "0 new" out loud is
      // the difference between "it worked" and "it did nothing".
      setNote(
        r.indexed === 0
          ? `Nothing new — the corpus already holds every send we can see (${r.total}).`
          : `${r.indexed} of your own replies read into the voice corpus${
              r.shows.length ? `, from ${r.shows.map((s) => s.title).join(", ")}` : ""
            }.`,
      );
      setVoice(r.voice);
      if (r.persona) {
        const merged = mergePersona(r.persona);
        setSaved(merged);
        if (!dirty) setDraft(structuredClone(merged));
      }
    } catch (e) {
      setError((e as Error).message);
    } finally {
      setLearning(false);
    }
  };

  const corpus = voice.docs;

  return (
    <AppShell
      section="persona"
      title="Persona"
      subtitle={
        saved?.updatedAt
          ? `last saved ${new Date(saved.updatedAt).toLocaleString()}`
          : "not written yet — every field below is empty"
      }
      actions={
        <Button variant="primary" onClick={() => void save()} disabled={busy || !dirty}>
          <Save className="size-3" aria-hidden /> {busy ? "Saving…" : dirty ? "Save" : "Saved"}
        </Button>
      }
    >
      {error ? (
        <Card tone="bad" className="mb-6 flex items-start gap-2 px-3 py-2.5">
          <AlertTriangle className="mt-0.5 size-3.5 shrink-0 text-bad" aria-hidden />
          <span className="text-[12.5px]">{error}</span>
        </Card>
      ) : null}

      <Section
        title="About"
        hint="Who is talking. This is the one paragraph every reply is written from, on every surface — the register below changes how it sounds, never who it is."
      >
        <div className="flex flex-col gap-2">
          <Field label="Name">
            <input
              value={draft.name}
              onChange={(e) => set("name", e.target.value)}
              placeholder="The Denim Vault"
              aria-label="Persona name"
              className="w-full rounded-sm bg-panel px-3 py-2 text-[13px] z1 placeholder:text-text-faint focus:outline-none focus:ring-[1.5px] focus:ring-accent"
            />
          </Field>
          <Field label="About">
            <textarea
              value={draft.about}
              onChange={(e) => set("about", e.target.value)}
              rows={3}
              placeholder="Fifteen years in vintage denim, mostly Japanese selvedge. Sells three nights a week."
              aria-label="About"
              className="w-full resize-y rounded-sm bg-panel px-3 py-2 text-[13px] leading-relaxed z1 placeholder:text-text-faint focus:outline-none focus:ring-[1.5px] focus:ring-accent"
            />
          </Field>
          <Field label="Voice">
            <textarea
              value={draft.voice}
              onChange={(e) => set("voice", e.target.value)}
              rows={3}
              placeholder="Direct, unhurried, never oversells. Answers the question asked and stops."
              aria-label="Voice"
              className="w-full resize-y rounded-sm bg-panel px-3 py-2 text-[13px] leading-relaxed z1 placeholder:text-text-faint focus:outline-none focus:ring-[1.5px] focus:ring-accent"
            />
          </Field>
          <Field label="Disclosure">
            <input
              value={draft.disclosure ?? ""}
              onChange={(e) => set("disclosure", e.target.value || null)}
              placeholder="Answered by the shop's assistant, on behalf of @denimvault"
              aria-label="Disclosure"
              className="w-full rounded-sm bg-panel px-3 py-2 text-[13px] z1 placeholder:text-text-faint focus:outline-none focus:ring-[1.5px] focus:ring-accent"
            />
            <p className="mt-1 text-[11.5px] leading-relaxed text-text-muted">
              What we must say about who is talking, wherever we post. A room can require its own
              wording instead — Rooms carries that, and the room&apos;s wins.
            </p>
          </Field>
        </div>
      </Section>

      <Section
        title="Boundaries"
        hint="Not preferences, and not one mechanism. The first two become never-say rules the guards check on the finished reply, so they are enforced rather than hoped for. The third is a prompt requirement, not a guard: it is what the copilot will always say, which is a promise about what is in a reply and not a check that blocks one."
      >
        <div className="grid gap-2.5 lg:grid-cols-3">
          {BOUNDARY_COPY.map((b) => (
            <ListEditor
              key={b.key}
              title={b.title}
              hint={b.hint}
              placeholder={b.placeholder}
              items={draft.boundaries[b.key] ?? []}
              onChange={(list) => setBoundary(b.key, list)}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Register, per surface"
        hint="The same person writes shorter and flatter in a subreddit than they talk on a live auction. A surface with no register here uses the voice above unchanged."
      >
        <div className="flex flex-col gap-1.5">
          {SURFACE_IDS.map((id) => (
            <RegisterRow
              key={id}
              surface={id}
              register={draft.registers[id] ?? null}
              onChange={(r) => {
                // Deleting the key, not writing undefined into it: "this
                // surface has no register" and "this surface has a register
                // whose value is nothing" are different rows to the backend.
                const next = { ...draft.registers };
                if (r) next[id] = r;
                else delete next[id];
                set("registers", next);
              }}
            />
          ))}
        </div>
      </Section>

      <Section
        title="Voice corpus"
        hint="Your own past replies and posts, indexed so a draft can be written the way you have answered before. A style reference is never grounding — no claim in a reply stands on one — which is why it renders muted on the card, under the guards."
      >
        <div className="mb-2.5 flex flex-wrap items-center gap-2">
          <Button onClick={() => void learn()} disabled={learning}>
            <Sparkles className="size-3" aria-hidden />
            {learning ? "Reading your sends…" : "Learn from my sends"}
          </Button>
          <span className="num text-[11.5px] text-text-muted">
            {voice.total} {voice.total === 1 ? "example" : "examples"}
            {voice.total > corpus.length ? ` · showing ${corpus.length}` : ""}
          </span>
          {note ? (
            <span className="anim-fade text-[11.5px] text-text-secondary">{note}</span>
          ) : null}
        </div>

        {corpus.length === 0 ? (
          <Card>
            <EmptyState
              icon={<PenLine className="size-5" aria-hidden />}
              title="Nothing learned yet."
            >
              Learn reads the replies you have actually sent — from your sessions, and from drafts you
              marked sent — and keeps them as examples of how you write. Nothing is invented and
              nothing is sent anywhere.
            </EmptyState>
          </Card>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {corpus.map((d) => (
              <CorpusRow key={d.factId} doc={d} />
            ))}
          </ul>
        )}
      </Section>
    </AppShell>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="section-header">{label}</span>
      <span className="mt-1 block">{children}</span>
    </label>
  );
}

/** One boundary list. Add on Enter, remove on the bin — the same shape the
 *  never-say list in Settings already uses. */
export function ListEditor({
  title,
  hint,
  placeholder,
  items,
  onChange,
}: {
  title: string;
  hint: string;
  placeholder: string;
  items: string[];
  onChange: (list: string[]) => void;
}) {
  const [value, setValue] = useState("");
  const add = () => {
    const v = value.trim();
    if (!v || items.includes(v)) {
      setValue("");
      return;
    }
    onChange([...items, v]);
    setValue("");
  };
  return (
    <Card className="flex flex-col p-3">
      <div className="section-header">{title}</div>
      <p className="mt-1 text-[11.5px] leading-relaxed text-text-muted">{hint}</p>
      <ul className="mt-2 flex flex-col gap-1">
        {items.length === 0 ? (
          <li className="text-[12px] text-text-faint">None — nothing is enforced for this yet.</li>
        ) : (
          items.map((it, i) => (
            <li
              key={`${it}-${i}`}
              className="flex items-center gap-1.5 rounded-sm bg-elevated px-2 py-1"
            >
              <span className="min-w-0 flex-1 text-[12px] text-text-secondary">{it}</span>
              <button
                type="button"
                onClick={() => onChange(items.filter((_, j) => j !== i))}
                aria-label={`Remove ${it}`}
                className="shrink-0 rounded-xs p-0.5 text-text-muted hover:text-bad"
              >
                <Trash2 className="size-3" aria-hidden />
              </button>
            </li>
          ))
        )}
      </ul>
      <div className="mt-2 flex items-center gap-1.5">
        <input
          value={value}
          onChange={(e) => setValue(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") {
              e.preventDefault();
              add();
            }
          }}
          placeholder={placeholder}
          aria-label={`Add to ${title}`}
          className="min-w-0 flex-1 rounded-sm bg-panel px-2 py-1.5 text-[12px] z1 placeholder:text-text-faint focus:outline-none focus:ring-[1.5px] focus:ring-accent"
        />
        <Button size="xs" onClick={add}>
          <Plus className="size-3" aria-hidden /> Add
        </Button>
      </div>
    </Card>
  );
}

const DEFAULT_REGISTER: PersonaRegister = {
  length: "short",
  formality: 3,
  emoji: false,
  notes: "",
};

/** Exported so a spec can drive one row without standing up the shell. */
export function RegisterRow({
  surface,
  register,
  onChange,
}: {
  surface: SurfaceId;
  register: PersonaRegister | null;
  onChange: (r: PersonaRegister | null) => void;
}) {
  const caps = capabilitiesOf(surface);
  const on = register !== null;
  const r = register ?? DEFAULT_REGISTER;
  return (
    <Card className={cn("px-3 py-2.5", !on && "opacity-80")}>
      <div className="flex flex-wrap items-center gap-2">
        <span className="min-w-[110px] text-[13px] font-medium">{SURFACE_LABEL[surface]}</span>
        <Badge>{caps.tempo}</Badge>
        {caps.delivery === "draft-only" ? <Badge tone="warn">draft-only</Badge> : null}
        <Button
          size="xs"
          variant={on ? "secondary" : "ghost"}
          className="ml-auto"
          onClick={() => onChange(on ? null : { ...DEFAULT_REGISTER })}
        >
          {on ? "Use the voice above" : "Set a register"}
        </Button>
      </div>

      {on ? (
        <div className="anim-in mt-2 flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-1.5 text-[12px] text-text-secondary">
            length
            <select
              value={r.length}
              onChange={(e) => onChange({ ...r, length: e.target.value as "short" | "medium" })}
              aria-label={`${SURFACE_LABEL[surface]} length`}
              className="rounded-sm bg-elevated px-1.5 py-1 text-[12px] focus:outline-none focus:ring-[1.5px] focus:ring-accent"
            >
              <option value="short">short</option>
              <option value="medium">medium</option>
            </select>
          </label>

          <label className="flex items-center gap-1.5 text-[12px] text-text-secondary">
            formality
            <input
              type="range"
              min={1}
              max={5}
              value={r.formality}
              onChange={(e) => onChange({ ...r, formality: Number(e.target.value) })}
              aria-label={`${SURFACE_LABEL[surface]} formality`}
              className="w-24"
            />
            <span className="num text-[11px] text-text-muted">{r.formality}/5</span>
          </label>

          <label className="flex items-center gap-1.5 text-[12px] text-text-secondary">
            <input
              type="checkbox"
              checked={r.emoji}
              onChange={(e) => onChange({ ...r, emoji: e.target.checked })}
              aria-label={`${SURFACE_LABEL[surface]} emoji`}
            />
            emoji
          </label>

          <input
            value={r.notes}
            onChange={(e) => onChange({ ...r, notes: e.target.value })}
            placeholder="anything else about how you write here"
            aria-label={`${SURFACE_LABEL[surface]} notes`}
            className="min-w-[180px] flex-1 rounded-sm bg-panel px-2 py-1.5 text-[12px] z1 placeholder:text-text-faint focus:outline-none focus:ring-[1.5px] focus:ring-accent"
          />
        </div>
      ) : null}
    </Card>
  );
}

export function CorpusRow({ doc }: { doc: VoiceCorpusDoc }) {
  return (
    <li>
      <Card className="flex flex-col gap-1 px-3 py-2.5">
        {/* The question first. The corpus is indexed on it as well as on the
            answer, because what is being matched is "what was I asked that was
            like this" — and reading the answer without it is reading half. */}
        {doc.question ? (
          <p className="text-[11.5px] leading-snug text-text-muted">{doc.question}</p>
        ) : null}
        <p className="text-[12.5px] leading-snug text-text-secondary">{doc.text}</p>
        <div className="flex flex-wrap items-center gap-2 text-[11px] text-text-muted">
          {/* Where it came from is the whole reason this is trustworthy as a
              style reference: it is a sentence the operator actually sent. */}
          <span className="truncate">
            {doc.origin === "pasted" ? "pasted in" : (doc.showTitle ?? "a session of yours")}
          </span>
          {doc.at ? <span className="num ml-auto">{timeAgo(doc.at)}</span> : null}
        </div>
      </Card>
    </li>
  );
}

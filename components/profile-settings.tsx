"use client";

import { useEffect, useRef, useState, type ChangeEvent } from "react";
import { createPortal } from "react-dom";
import {
  Camera,
  ChevronDown,
  Check,
  ImagePlus,
  Loader2,
  LogOut,
  Palette,
  Settings2,
  Trash2,
  X,
} from "lucide-react";

import { useAccessActions } from "@/components/access-gate";
import { ThemeToggle } from "@/components/theme-toggle";
import { useToast } from "@/components/ui/toast";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { createSupabaseBrowserClient } from "@/lib/supabase-browser";
import {
  type Profile,
  type ProfileAccent,
  type ProfileDisplayMode,
} from "@/types/profile";

const accentOptions: Array<{
  value: ProfileAccent;
  label: string;
  className: string;
}> = [
  { value: "teal", label: "Turquesa", className: "bg-teal-400" },
  { value: "cyan", label: "Ciano", className: "bg-cyan-400" },
  { value: "blue", label: "Azul", className: "bg-blue-400" },
  { value: "indigo", label: "Indigo", className: "bg-indigo-400" },
  { value: "violet", label: "Violeta", className: "bg-violet-400" },
  { value: "fuchsia", label: "Fucsia", className: "bg-fuchsia-400" },
  { value: "orange", label: "Laranja", className: "bg-orange-400" },
  { value: "emerald", label: "Esmeralda", className: "bg-emerald-400" },
  { value: "amber", label: "Âmbar", className: "bg-amber-400" },
  { value: "rose", label: "Rosa", className: "bg-rose-400" },
];

function getFallbackNickname(email: string | null) {
  const localPart = email?.split("@")[0]?.trim();
  return localPart || "Usuário";
}

function getInitials(nickname: string) {
  return nickname
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("") || "U";
}

function getAccentClasses(accent: ProfileAccent) {
  return {
    teal: "border-teal-400/50 bg-teal-400/15 text-teal-700 dark:text-teal-200",
    cyan: "border-cyan-400/50 bg-cyan-400/15 text-cyan-700 dark:text-cyan-200",
    blue: "border-blue-400/50 bg-blue-400/15 text-blue-700 dark:text-blue-200",
    indigo:
      "border-indigo-400/50 bg-indigo-400/15 text-indigo-700 dark:text-indigo-200",
    violet:
      "border-violet-400/50 bg-violet-400/15 text-violet-700 dark:text-violet-200",
    fuchsia:
      "border-fuchsia-400/50 bg-fuchsia-400/15 text-fuchsia-700 dark:text-fuchsia-200",
    amber:
      "border-amber-400/50 bg-amber-400/15 text-amber-700 dark:text-amber-200",
    rose: "border-rose-400/50 bg-rose-400/15 text-rose-700 dark:text-rose-200",
    orange:
      "border-orange-400/50 bg-orange-400/15 text-orange-700 dark:text-orange-200",
    emerald:
      "border-emerald-400/50 bg-emerald-400/15 text-emerald-700 dark:text-emerald-200",
  }[accent];
}

interface ProfileSettingsProps {
  profile: Profile | null;
  userEmail: string | null;
  onProfileChange: (profile: Profile) => void;
  displayMode: ProfileDisplayMode;
  onDisplayModeChange: (mode: ProfileDisplayMode) => void;
  onOpenTrash: () => void;
}

export function ProfileSettings({
  profile,
  userEmail,
  onProfileChange,
  displayMode,
  onDisplayModeChange,
  onOpenTrash,
}: ProfileSettingsProps) {
  const fallbackNickname = getFallbackNickname(userEmail);
  const [open, setOpen] = useState(false);
  const [nickname, setNickname] = useState(
    profile?.nickname || fallbackNickname,
  );
  const [accentColor, setAccentColor] = useState<ProfileAccent>(
    profile?.accent_color ?? "teal",
  );
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [removeAvatar, setRemoveAvatar] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const profileMenuRef = useRef<HTMLDivElement>(null);
  const profileTriggerRef = useRef<HTMLButtonElement>(null);
  const profileMenuContentRef = useRef<HTMLDivElement>(null);
  const profileLaserRef = useRef<HTMLSpanElement>(null);
  const profileEdgeTopRef = useRef<HTMLSpanElement>(null);
  const profileEdgeBottomRef = useRef<HTMLSpanElement>(null);
  const profileWaveRef = useRef<HTMLSpanElement>(null);
  const profileAvatarOrbitRef = useRef<HTMLSpanElement>(null);
  const toast = useToast();
  const { signOut } = useAccessActions();
  const [profileMenuOpen, setProfileMenuOpen] = useState(false);
  const [profileMenuReady, setProfileMenuReady] = useState(false);
  const [profileMenuPosition, setProfileMenuPosition] = useState({
    left: 8,
    top: 8,
  });

  useEffect(() => {
    if (!profileMenuOpen) return;

    const handleOutsidePointerDown = (event: PointerEvent) => {
      if (
        event.target instanceof Node &&
        !profileMenuRef.current?.contains(event.target) &&
        !profileMenuContentRef.current?.contains(event.target)
      ) {
        setProfileMenuOpen(false);
      }
    };

    document.addEventListener("pointerdown", handleOutsidePointerDown);
    return () =>
      document.removeEventListener("pointerdown", handleOutsidePointerDown);
  }, [profileMenuOpen]);

  useEffect(() => {
    const laser = profileLaserRef.current;
    const edgeTop = profileEdgeTopRef.current;
    const edgeBottom = profileEdgeBottomRef.current;
    const wave = profileWaveRef.current;
    const avatarOrbit = profileAvatarOrbitRef.current;

    if (!laser || !edgeTop || !edgeBottom || !wave || !avatarOrbit) {
      return;
    }

    const startedAt = performance.now();
    let frame = 0;

    const setMovingElement = (
      element: HTMLElement,
      progress: number,
      start: number,
      distance: number,
      skew = 0,
    ) => {
      const distanceProgress = start + progress * distance;
      element.style.transform = `translate3d(${distanceProgress}%, 0, 0)${skew ? ` skewX(${skew}deg)` : ""}`;
      element.style.opacity = `${Math.min(1, Math.max(0, Math.sin(progress * Math.PI) * 1.35))}`;
    };

    const animate = (now: number) => {
      const elapsed = now - startedAt;
      const laserProgress = (elapsed % 2350) / 2350;
      const edgeProgress = (elapsed % 2350) / 2350;
      const waveProgress = (elapsed % 4600) / 4600;
      const orbitProgress = (elapsed % 3800) / 3800;

      setMovingElement(laser, laserProgress, 0, 610, -18);
      setMovingElement(edgeTop, edgeProgress, -130, 570);
      setMovingElement(edgeBottom, 1 - edgeProgress, -130, 570);
      setMovingElement(wave, waveProgress, -150, 560, -22);
      avatarOrbit.style.transform = `rotate(${orbitProgress * 360}deg)`;
      avatarOrbit.style.opacity = `${0.75 + Math.sin(orbitProgress * Math.PI * 2) * 0.25}`;

      frame = window.requestAnimationFrame(animate);
    };

    frame = window.requestAnimationFrame(animate);
    return () => window.cancelAnimationFrame(frame);
  }, []);

  useEffect(() => {
    if (!profileMenuOpen) {
      return;
    }

    const updateMenuPosition = () => {
      const trigger = profileTriggerRef.current;
      if (!trigger) return;

      const triggerRect = trigger.getBoundingClientRect();
      const menuWidth = Math.min(224, window.innerWidth - 16);
      const menuHeight = profileMenuContentRef.current?.offsetHeight ?? 136;
      const maxLeft = Math.max(8, window.innerWidth - menuWidth - 8);
      const left = Math.min(
        Math.max(8, triggerRect.right - menuWidth),
        maxLeft,
      );
      const gap = 8;
      const top =
        triggerRect.bottom + gap + menuHeight <= window.innerHeight - 8
          ? triggerRect.bottom + gap
          : Math.max(8, triggerRect.top - menuHeight - gap);

      setProfileMenuPosition({ left, top });
      setProfileMenuReady(true);
    };

    const frame = window.requestAnimationFrame(updateMenuPosition);
    window.addEventListener("resize", updateMenuPosition);
    window.addEventListener("scroll", updateMenuPosition, true);

    return () => {
      window.cancelAnimationFrame(frame);
      window.removeEventListener("resize", updateMenuPosition);
      window.removeEventListener("scroll", updateMenuPosition, true);
    };
  }, [profileMenuOpen]);

  const displayNickname = profile?.nickname || fallbackNickname;
  const displayAccent = profile?.accent_color ?? "teal";
  const displayAvatar = profile?.avatar_url ?? null;
  const avatarSource = removeAvatar ? null : avatarPreview ?? displayAvatar;

  const handleAvatarChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Escolha uma imagem válida.");
      return;
    }

    if (file.size > 4 * 1024 * 1024) {
      setError("A imagem deve ter no máximo 4 MB.");
      return;
    }

    setError(null);
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
    setRemoveAvatar(false);
  };

  const handleSave = async () => {
    if (!profile) {
      setError("Seu perfil ainda está carregando. Tente novamente em instantes.");
      return;
    }

    const nextNickname = nickname.trim().slice(0, 40);
    if (!nextNickname) {
      setError("Digite um nickname para continuar.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const supabase = createSupabaseBrowserClient();
      let avatarUrl = removeAvatar ? null : profile.avatar_url;

      if (avatarFile) {
        const extension = avatarFile.type.split("/")[1] || "png";
        const avatarPath = `${profile.id}/avatar.${extension}`;
        const uploadResult = await supabase.storage
          .from("profile-avatars")
          .upload(avatarPath, avatarFile, {
            cacheControl: "3600",
            contentType: avatarFile.type,
            upsert: true,
          });

        if (uploadResult.error) throw new Error(uploadResult.error.message);

        avatarUrl = `${supabase.storage.from("profile-avatars").getPublicUrl(avatarPath).data.publicUrl}?v=${Date.now()}`;
      }

      const { data, error: updateError } = await supabase
        .from("profiles")
        .upsert({
          id: profile.id,
          nickname: nextNickname,
          avatar_url: avatarUrl,
          accent_color: accentColor,
        })
        .select("id,nickname,avatar_url,accent_color,display_mode,task_column_widths,created_at,updated_at")
        .single();

      if (updateError || !data) {
        throw new Error(updateError?.message ?? "Não foi possível salvar o perfil.");
      }

      const nextProfile = data as Profile;
      onProfileChange(nextProfile);
      setAvatarFile(null);
      setAvatarPreview(null);
      setRemoveAvatar(false);
      setOpen(false);
      toast.success(`Perfil atualizado, ${nextProfile.nickname}!`);
    } catch (caughtError) {
      const message =
        caughtError instanceof Error
          ? caughtError.message
          : "Não foi possível salvar o perfil.";
      setError(message);
      toast.error(message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <div ref={profileMenuRef} className="relative">
        <Button
          ref={profileTriggerRef}
          type="button"
          variant="outline"
          className="profile-account-trigger h-14 max-w-[17rem] gap-3 rounded-full px-2.5 transition-all duration-300 sm:h-12 sm:px-3"
          onClick={() => {
            if (profileMenuOpen) {
              setProfileMenuOpen(false);
              return;
            }

            setProfileMenuReady(false);
            setProfileMenuOpen(true);
          }}
          title="Abrir menu da conta"
          aria-label={`Abrir menu da conta de ${displayNickname}`}
          aria-expanded={profileMenuOpen}
          aria-haspopup="menu"
          aria-controls="profile-account-menu"
          data-open={profileMenuOpen}
        >
          <span className="profile-account-energy" aria-hidden="true">
            <span ref={profileLaserRef} className="profile-account-laser" />
            <span
              ref={profileEdgeTopRef}
              className="profile-account-edge-run profile-account-edge-run-top"
            />
            <span
              ref={profileEdgeBottomRef}
              className="profile-account-edge-run profile-account-edge-run-bottom"
            />
            <span ref={profileWaveRef} className="profile-account-energy-wave" />
          </span>
          <span
            className={`profile-account-avatar relative z-10 grid size-11 shrink-0 place-items-center rounded-full border text-xs font-bold sm:size-10 ${getAccentClasses(displayAccent)}`}
          >
            <span className="profile-account-avatar-aura" aria-hidden="true" />
            <span className="profile-account-avatar-pulse" aria-hidden="true" />
            <span
              className="profile-account-avatar-ring absolute -inset-1 rounded-full border border-current"
              aria-hidden="true"
            />
            <span
              ref={profileAvatarOrbitRef}
              className="profile-account-avatar-orbit"
              aria-hidden="true"
            />
            <span className="relative z-10 grid size-full place-items-center overflow-hidden rounded-full">
              {displayAvatar ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={displayAvatar}
                  alt=""
                  className="size-full rounded-full object-cover"
                />
              ) : (
                getInitials(displayNickname)
              )}
            </span>
          </span>
          <span className="relative z-10 hidden min-w-0 max-w-36 flex-col items-start text-left leading-none sm:flex">
            <span className="profile-account-eyebrow mb-1 text-[0.6rem] font-semibold uppercase tracking-[0.16em] text-slate-500 dark:text-white/45">
              Meu espaço
            </span>
            <span className="profile-account-name max-w-full truncate text-[0.95rem] font-semibold tracking-tight">
              {displayNickname}
            </span>
          </span>
          <ChevronDown
            className={`profile-account-chevron relative z-10 size-4 shrink-0 transition-transform duration-300 ${profileMenuOpen ? "rotate-180" : ""}`}
          />
        </Button>

        {profileMenuOpen
          ? createPortal(
              <div
                ref={profileMenuContentRef}
                id="profile-account-menu"
                role="menu"
                aria-label="Menu da conta"
                style={profileMenuPosition}
                className={`fixed z-[200] w-56 max-w-[calc(100vw-1rem)] origin-top-right rounded-2xl border border-slate-900/15 bg-white p-1.5 text-slate-700 shadow-[0_24px_70px_rgb(15_23_42_/_28%)] transition-all duration-200 dark:border-white/15 dark:bg-zinc-950 dark:text-white ${profileMenuReady ? "visible translate-y-0 scale-100 opacity-100" : "pointer-events-none invisible -translate-y-2 scale-95 opacity-0"}`}
              >
          <button
            type="button"
            role="menuitem"
            className="app-menu-action flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
            onClick={() => {
              setProfileMenuOpen(false);
              setOpen(true);
            }}
          >
            <Settings2 className="size-4 text-violet-500" />
            <span>
              <span className="block text-sm font-semibold">Preferências</span>
              <span className="block text-xs text-slate-500 dark:text-white/45">
                Personalizar seu espaço
              </span>
            </span>
          </button>
          <button
            type="button"
            role="menuitem"
            className="app-menu-action flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left"
            onClick={() => { setProfileMenuOpen(false); onOpenTrash(); }}
          >
            <Trash2 className="size-4 text-slate-500" />
            <span><span className="block text-sm font-semibold">Lixeira</span><span className="block text-xs text-slate-500 dark:text-white/45">Restaurar tarefas e anotações</span></span>
          </button>
          <div className="my-1 border-t border-slate-900/10 dark:border-white/10" />
          <button
            type="button"
            role="menuitem"
            className="app-menu-action app-menu-action-danger flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left text-rose-600 dark:text-rose-400"
            onClick={() => {
              setProfileMenuOpen(false);
              void signOut();
            }}
          >
            <LogOut className="size-4" />
            <span className="text-sm font-semibold">Sair</span>
          </button>
              </div>,
              document.body,
            )
          : null}
      </div>

      <DialogContent className="max-h-[min(88svh,40rem)] w-[calc(100vw-2rem)] max-w-2xl overflow-y-auto p-0 sm:w-[min(92vw,52rem)] sm:max-w-[52rem]">
        <div className="border-b border-slate-900/10 px-5 py-4 dark:border-white/10 sm:px-6 sm:py-5">
          <div className="flex items-center gap-3 pr-8">
            <span
              className={`grid size-14 shrink-0 place-items-center overflow-hidden rounded-2xl border-2 text-lg font-bold shadow-lg ${getAccentClasses(accentColor)}`}
            >
              {avatarSource ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarSource} alt="" className="size-full object-cover" />
              ) : (
                getInitials(nickname || fallbackNickname)
              )}
            </span>
            <div>
              <DialogTitle className="text-lg">Meu perfil</DialogTitle>
              <DialogDescription className="mt-1">
                Deixe o Taskboard com mais a sua cara.
                {userEmail ? ` · ${userEmail}` : ""}
              </DialogDescription>
            </div>
          </div>
        </div>

        <div className="space-y-4 px-5 py-4 sm:px-6 sm:py-5">
          <div className="rounded-2xl border border-slate-900/10 bg-slate-950/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className="text-sm font-medium">Imagem de perfil</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-white/45">
                  PNG, JPG ou GIF com até 4 MB.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleAvatarChange}
                />
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={saving}
                >
                  <ImagePlus className="size-3.5" />
                  Escolher imagem
                </Button>
                {(avatarSource || avatarFile) && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => {
                      setAvatarFile(null);
                      setAvatarPreview(null);
                      setRemoveAvatar(true);
                    }}
                    disabled={saving}
                  >
                    <X className="size-3.5" />
                    Remover
                  </Button>
                )}
              </div>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-900/10 bg-slate-950/[0.025] p-4 dark:border-white/10 dark:bg-white/[0.035]">
            <div className="flex flex-wrap items-center justify-between gap-4">
              <div>
                <p className="text-sm font-medium">Aparência do quadro</p>
                <p className="mt-1 text-xs leading-relaxed text-slate-500 dark:text-white/45">
                  Escolha o tema e a quantidade de conteúdo exibida no quadro.
                </p>
              </div>
              <ThemeToggle />
            </div>
            <div className="mt-4 grid grid-cols-2 gap-2 rounded-2xl border border-slate-900/10 bg-white/60 p-1 dark:border-white/10 dark:bg-white/[0.04]">
              {([
                ["full", "Completo", "Mostra mais detalhes"],
                ["compact", "Compacto", "Mostra mais tarefas"],
              ] as const).map(([mode, label, description]) => (
                <button
                  key={mode}
                  type="button"
                  className={`app-choice-button rounded-xl px-3 py-2 text-left ${displayMode === mode ? "bg-slate-900 text-white shadow-sm dark:bg-white dark:text-zinc-950" : "text-slate-600 dark:text-white/65"}`}
                  onClick={() => onDisplayModeChange(mode)}
                  aria-pressed={displayMode === mode}
                >
                  <span className="block text-xs font-semibold">{label}</span>
                  <span className={`mt-0.5 block text-[0.68rem] ${displayMode === mode ? "text-white/70 dark:text-zinc-950/65" : "text-slate-400 dark:text-white/40"}`}>
                    {description}
                  </span>
                </button>
              ))}
            </div>
          </div>

          <label className="block space-y-1.5">
            <span className="text-sm font-medium">Como quer ser chamado?</span>
            <Input
              value={nickname}
              onChange={(event) => setNickname(event.target.value)}
              maxLength={40}
              placeholder="Seu nickname"
              disabled={saving}
              className="h-11 rounded-xl"
            />
            <span className="text-xs text-slate-400 dark:text-white/35">
              Esse nome aparece nas boas-vindas e confirmações do sistema.
            </span>
          </label>

          <div className="space-y-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <Palette className="size-4 text-slate-400" />
              Cor do seu perfil
            </div>
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
              {accentOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  className={`app-choice-button inline-flex min-h-10 w-full items-center justify-start gap-2 rounded-full border px-3 text-xs font-medium ${accentColor === option.value ? "border-slate-900/30 bg-slate-900/5 dark:border-white/30 dark:bg-white/10" : "border-slate-900/10 bg-white/60 dark:border-white/10 dark:bg-white/[0.04]"}`}
                  onClick={() => setAccentColor(option.value)}
                  disabled={saving}
                  aria-pressed={accentColor === option.value}
                >
                  <span className={`size-3 rounded-full ${option.className}`} />
                  {option.label}
                  {accentColor === option.value ? (
                    <Check className="size-3.5" />
                  ) : null}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <p className="rounded-xl border border-rose-500/20 bg-rose-500/10 px-3 py-2 text-sm text-rose-700 dark:text-rose-200">
              {error}
            </p>
          ) : null}
        </div>

        <div className="flex justify-end gap-2 border-t border-slate-900/10 px-5 py-4 dark:border-white/10 sm:px-6">
          <Button
            type="button"
            variant="ghost"
            onClick={() => setOpen(false)}
            disabled={saving}
          >
            Cancelar
          </Button>
          <Button type="button" onClick={() => void handleSave()} disabled={saving}>
            {saving ? <Loader2 className="size-4 animate-spin" /> : <Camera className="size-4" />}
            {saving ? "Salvando…" : "Salvar perfil"}
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

"use client";

import { useEditor, EditorContent } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import Underline from "@tiptap/extension-underline";
import Link from "@tiptap/extension-link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Bold, Italic, Underline as UnderlineIcon, Strikethrough,
    List, ListOrdered, Link as LinkIcon, Undo, Redo,
    Quote, Code, Heading2, Heading3, Unlink, ExternalLink
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useEffect, useState, useRef } from "react";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Label } from "@/components/ui/label";

interface TipTapEditorProps {
    content: string;
    onChange: (html: string) => void;
    placeholder?: string;
    className?: string;
}

export function TipTapEditor({ content, onChange, placeholder, className }: TipTapEditorProps) {
    const [linkUrl, setLinkUrl] = useState("");
    const [linkLabel, setLinkLabel] = useState("");
    const [linkPopoverOpen, setLinkPopoverOpen] = useState(false);
    const linkInputRef = useRef<HTMLInputElement>(null);

    const editor = useEditor({
        immediatelyRender: false,   // ← Fix SSR/hydration error
        extensions: [
            StarterKit,
            Underline,
            Link.configure({
                openOnClick: false,
                autolink: true,
                HTMLAttributes: {
                    class: "text-primary underline underline-offset-2 hover:opacity-80 cursor-pointer",
                    target: "_blank",
                    rel: "noopener noreferrer",
                },
            }),
        ],
        content,
        editorProps: {
            attributes: {
                class: "prose prose-sm max-w-none focus:outline-none min-h-[100px] px-3 py-2 text-sm text-slate-800",
            },
        },
        onUpdate: ({ editor }) => {
            onChange(editor.getHTML());
        },
    });

    // Sync content when switching nodes
    useEffect(() => {
        if (editor && editor.getHTML() !== content) {
            editor.commands.setContent(content || "", { emitUpdate: false });
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [content, editor]);

    // When popover opens, prefill with existing link
    useEffect(() => {
        if (linkPopoverOpen && editor) {
            const existing = editor.getAttributes("link").href ?? "";
            setLinkUrl(existing);
            setLinkLabel(editor.state.selection.empty ? "" : editor.state.doc.textBetween(
                editor.state.selection.from, editor.state.selection.to
            ));
            setTimeout(() => linkInputRef.current?.focus(), 100);
        }
    }, [linkPopoverOpen, editor]);

    if (!editor) return null;

    const ToolbarButton = ({
        onClick,
        active,
        title,
        children,
        disabled,
    }: {
        onClick: () => void;
        active?: boolean;
        title: string;
        children: React.ReactNode;
        disabled?: boolean;
    }) => (
        <Button
            type="button"
            variant={active ? "secondary" : "ghost"}
            size="sm"
            className={cn("h-7 w-7 p-0 shrink-0", active && "text-primary bg-primary/10")}
            title={title}
            disabled={disabled}
            onMouseDown={(e) => e.preventDefault()}
            onClick={onClick}
        >
            {children}
        </Button>
    );

    const handleApplyLink = () => {
        if (!editor) return;
        if (!linkUrl.trim()) {
            editor.chain().focus().extendMarkRange("link").unsetLink().run();
        } else {
            const url = linkUrl.startsWith("http") ? linkUrl : `https://${linkUrl}`;
            if (editor.state.selection.empty && linkLabel.trim()) {
                // Insert text with link applied
                editor.chain().focus()
                    .insertContent(`<a href="${url}" target="_blank">${linkLabel}</a>`)
                    .run();
            } else {
                editor.chain().focus().extendMarkRange("link").setLink({ href: url }).run();
            }
        }
        setLinkPopoverOpen(false);
        setLinkUrl("");
        setLinkLabel("");
    };

    const handleRemoveLink = () => {
        editor.chain().focus().extendMarkRange("link").unsetLink().run();
        setLinkPopoverOpen(false);
    };

    const isLinkActive = editor.isActive("link");
    const hasSelection = !editor.state.selection.empty;

    return (
        <div className={cn("rounded-lg border border-slate-200 bg-white overflow-hidden focus-within:ring-2 focus-within:ring-primary/20 focus-within:border-primary/30 transition-all shadow-sm", className)}>
            {/* ── Toolbar ── */}
            <div className="flex flex-wrap items-center gap-0.5 px-2 py-1.5 border-b border-slate-100 bg-slate-50/80">

                {/* Text style group */}
                <div className="flex items-center gap-0.5">
                    <ToolbarButton onClick={() => editor.chain().focus().toggleBold().run()} active={editor.isActive("bold")} title="Negrita (Ctrl+B)">
                        <Bold className="w-3 h-3" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleItalic().run()} active={editor.isActive("italic")} title="Itálica (Ctrl+I)">
                        <Italic className="w-3 h-3" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleUnderline().run()} active={editor.isActive("underline")} title="Subrayado (Ctrl+U)">
                        <UnderlineIcon className="w-3 h-3" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleStrike().run()} active={editor.isActive("strike")} title="Tachado">
                        <Strikethrough className="w-3 h-3" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleCode().run()} active={editor.isActive("code")} title="Código en línea">
                        <Code className="w-3 h-3" />
                    </ToolbarButton>
                </div>

                <div className="w-px h-4 bg-slate-200 mx-0.5" />

                {/* Headings */}
                <div className="flex items-center gap-0.5">
                    <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} active={editor.isActive("heading", { level: 2 })} title="Encabezado 2">
                        <Heading2 className="w-3 h-3" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} active={editor.isActive("heading", { level: 3 })} title="Encabezado 3">
                        <Heading3 className="w-3 h-3" />
                    </ToolbarButton>
                </div>

                <div className="w-px h-4 bg-slate-200 mx-0.5" />

                {/* Lists */}
                <div className="flex items-center gap-0.5">
                    <ToolbarButton onClick={() => editor.chain().focus().toggleBulletList().run()} active={editor.isActive("bulletList")} title="Lista con viñetas">
                        <List className="w-3 h-3" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleOrderedList().run()} active={editor.isActive("orderedList")} title="Lista numerada">
                        <ListOrdered className="w-3 h-3" />
                    </ToolbarButton>
                    <ToolbarButton onClick={() => editor.chain().focus().toggleBlockquote().run()} active={editor.isActive("blockquote")} title="Cita / Nota legal">
                        <Quote className="w-3 h-3" />
                    </ToolbarButton>
                </div>

                <div className="w-px h-4 bg-slate-200 mx-0.5" />

                {/* Link popover */}
                <Popover open={linkPopoverOpen} onOpenChange={setLinkPopoverOpen}>
                    <PopoverTrigger asChild>
                        <Button
                            type="button"
                            variant={isLinkActive ? "secondary" : "ghost"}
                            size="sm"
                            className={cn("h-7 w-7 p-0 shrink-0", isLinkActive && "text-primary bg-primary/10")}
                            title={isLinkActive ? "Editar enlace" : "Insertar hipervínculo"}
                            onMouseDown={(e) => e.preventDefault()}
                        >
                            <LinkIcon className="w-3 h-3" />
                        </Button>
                    </PopoverTrigger>
                    <PopoverContent className="w-72 p-4 shadow-xl border-slate-200" align="start">
                        <p className="text-xs font-bold text-slate-700 mb-3 flex items-center gap-1.5">
                            <ExternalLink className="w-3 h-3 text-primary" />
                            {isLinkActive ? "Editar hipervínculo" : "Insertar hipervínculo"}
                        </p>
                        <div className="space-y-3">
                            {!hasSelection && !isLinkActive && (
                                <div className="space-y-1">
                                    <Label className="text-xs text-slate-600">Texto del enlace</Label>
                                    <Input
                                        value={linkLabel}
                                        onChange={(e) => setLinkLabel(e.target.value)}
                                        placeholder="Ej. Reglamento interno"
                                        className="h-8 text-xs"
                                    />
                                </div>
                            )}
                            <div className="space-y-1">
                                <Label className="text-xs text-slate-600">URL de destino</Label>
                                <Input
                                    ref={linkInputRef}
                                    value={linkUrl}
                                    onChange={(e) => setLinkUrl(e.target.value)}
                                    placeholder="https://ejemplo.com"
                                    className="h-8 text-xs"
                                    onKeyDown={(e) => e.key === "Enter" && handleApplyLink()}
                                />
                            </div>
                            <p className="text-[10px] text-slate-400">El enlace se abrirá en una nueva pestaña.</p>
                            <div className="flex gap-2">
                                <Button size="sm" className="flex-1 h-7 text-xs" onClick={handleApplyLink}>
                                    {isLinkActive ? "Actualizar" : "Insertar"}
                                </Button>
                                {isLinkActive && (
                                    <Button size="sm" variant="outline" className="h-7 text-xs gap-1 text-destructive border-destructive/30" onClick={handleRemoveLink}>
                                        <Unlink className="w-3 h-3" /> Quitar
                                    </Button>
                                )}
                            </div>
                        </div>
                    </PopoverContent>
                </Popover>

                <div className="flex-1" />

                {/* History */}
                <div className="flex items-center gap-0.5">
                    <ToolbarButton
                        onClick={() => editor.chain().focus().undo().run()}
                        disabled={!editor.can().undo()}
                        title="Deshacer (Ctrl+Z)"
                    >
                        <Undo className="w-3 h-3" />
                    </ToolbarButton>
                    <ToolbarButton
                        onClick={() => editor.chain().focus().redo().run()}
                        disabled={!editor.can().redo()}
                        title="Rehacer (Ctrl+Y)"
                    >
                        <Redo className="w-3 h-3" />
                    </ToolbarButton>
                </div>
            </div>

            {/* Editor area */}
            <div className="max-h-[300px] overflow-y-auto relative">
                {!editor.getText() && placeholder && (
                    <p className="absolute top-2 left-3 text-sm text-slate-400 pointer-events-none select-none">
                        {placeholder}
                    </p>
                )}
                <EditorContent editor={editor} />
            </div>
        </div>
    );
}

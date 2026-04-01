"use client";

import type { ComponentPropsWithoutRef } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

import { cn } from "@/lib/utils";

interface MarkdownContentProps extends ComponentPropsWithoutRef<"div"> {
  content: string;
}

export function MarkdownContent({
  className,
  content,
  ...props
}: MarkdownContentProps) {
  return (
    <div
      className={cn(
        "max-w-none text-sm leading-7 text-foreground",
        className,
      )}
      {...props}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          h1: ({ node: _node, className: headingClassName, ...headingProps }) => (
            <h1
              className={cn(
                "mt-8 font-serif text-3xl leading-tight tracking-[-0.03em] first:mt-0",
                headingClassName,
              )}
              {...headingProps}
            />
          ),
          h2: ({ node: _node, className: headingClassName, ...headingProps }) => (
            <h2
              className={cn(
                "mt-8 font-serif text-2xl leading-tight tracking-[-0.03em] first:mt-0",
                headingClassName,
              )}
              {...headingProps}
            />
          ),
          h3: ({ node: _node, className: headingClassName, ...headingProps }) => (
            <h3
              className={cn(
                "mt-6 font-serif text-xl leading-tight tracking-[-0.02em]",
                headingClassName,
              )}
              {...headingProps}
            />
          ),
          p: ({ node: _node, className: paragraphClassName, ...paragraphProps }) => (
            <p className={cn("mt-4 text-sm leading-7 first:mt-0", paragraphClassName)} {...paragraphProps} />
          ),
          ul: ({ node: _node, className: listClassName, ...listProps }) => (
            <ul className={cn("mt-4 list-disc space-y-2 pl-5", listClassName)} {...listProps} />
          ),
          ol: ({ node: _node, className: listClassName, ...listProps }) => (
            <ol className={cn("mt-4 list-decimal space-y-2 pl-5", listClassName)} {...listProps} />
          ),
          li: ({ node: _node, className: itemClassName, ...itemProps }) => (
            <li className={cn("pl-1", itemClassName)} {...itemProps} />
          ),
          blockquote: ({ node: _node, className: quoteClassName, ...quoteProps }) => (
            <blockquote
              className={cn(
                "mt-4 border-l-2 border-border pl-4 italic text-muted-foreground",
                quoteClassName,
              )}
              {...quoteProps}
            />
          ),
          hr: ({ node: _node, className: ruleClassName, ...ruleProps }) => (
            <hr className={cn("my-6 border-border", ruleClassName)} {...ruleProps} />
          ),
          a: ({ node: _node, className: linkClassName, ...linkProps }) => (
            <a className={cn("font-medium text-primary underline underline-offset-4", linkClassName)} {...linkProps} />
          ),
          code: ({ node: _node, className: codeClassName, ...codeProps }) => (
            <code
              className={cn(
                "rounded-md bg-muted px-1.5 py-0.5 font-mono text-[0.9em]",
                codeClassName,
              )}
              {...codeProps}
            />
          ),
          pre: ({ node: _node, className: preClassName, ...preProps }) => (
            <pre
              className={cn(
                "mt-4 overflow-x-auto rounded-2xl border border-border bg-background p-4 text-sm leading-6",
                preClassName,
              )}
              {...preProps}
            />
          ),
          table: ({ node: _node, className: tableClassName, ...tableProps }) => (
            <div className="mt-4 overflow-x-auto">
              <table className={cn("w-full border-collapse text-left text-sm", tableClassName)} {...tableProps} />
            </div>
          ),
          th: ({ node: _node, className: headerClassName, ...headerProps }) => (
            <th
              className={cn(
                "border-b border-border px-3 py-2 font-medium text-foreground",
                headerClassName,
              )}
              {...headerProps}
            />
          ),
          td: ({ node: _node, className: cellClassName, ...cellProps }) => (
            <td className={cn("border-b border-border/60 px-3 py-2 align-top", cellClassName)} {...cellProps} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

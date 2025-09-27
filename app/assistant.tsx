"use client";

import { AssistantRuntimeProvider } from "@assistant-ui/react";
import { useEffect, useState } from "react";
import {
  useChatRuntime,
  AssistantChatTransport,
} from "@assistant-ui/react-ai-sdk";
import { Thread } from "@/components/assistant-ui/thread";
import { SidebarInset, SidebarProvider, SidebarTrigger } from "@/components/ui/sidebar";
import { ThreadListSidebar } from "@/components/assistant-ui/threadlist-sidebar";
import { ResizablePanelGroup, ResizablePanel, ResizableHandle } from "@/components/ui/resizable";
import { Separator } from "@/components/ui/separator";
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from "@/components/ui/breadcrumb";

export const Assistant = () => {
  const runtime = useChatRuntime({
    transport: new AssistantChatTransport({
      api: "/api/chat",
    }),
  });

  return (
    <AssistantRuntimeProvider runtime={runtime}>
      <SidebarProvider>
        <div className="flex h-dvh w-full pr-0.5">
        <ThreadListSidebar />
          <ResizablePanelGroup direction="horizontal" className="flex-1">
            
            <ResizablePanel minSize={20} defaultSize={30} className="min-w-[320px] max-w-[50%] border-r">
              <DesktopFrame />
            </ResizablePanel>
            <ResizableHandle withHandle />
            <ResizablePanel minSize={30} className="min-w-0">
              <SidebarInset>
            <header className="flex h-16 shrink-0 items-center gap-2 border-b px-4">
              <SidebarTrigger />
              <Separator orientation="vertical" className="mr-2 h-4" />
              <Breadcrumb>
                <BreadcrumbList>
                  <BreadcrumbItem className="hidden md:block">
                    <BreadcrumbLink
                      href="https://www.assistant-ui.com/docs/getting-started"
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      Build Your Own ChatGPT UX
                    </BreadcrumbLink>
                  </BreadcrumbItem>
                  <BreadcrumbSeparator className="hidden md:block" />
                  <BreadcrumbItem>
                    <BreadcrumbPage>Starter Template</BreadcrumbPage>
                  </BreadcrumbItem>
                </BreadcrumbList>
              </Breadcrumb>
            </header>
              <div className="flex-1 overflow-hidden">
                <Thread />
              </div>
              </SidebarInset>
            </ResizablePanel>
          </ResizablePanelGroup>
        </div>
      </SidebarProvider>
    </AssistantRuntimeProvider>
  );
};

function DesktopFrame() {
  const [src, setSrc] = useState<string | null>(null);

  const getCookie = (name: string): string | undefined => {
    if (typeof document === "undefined") return undefined;
    const match = document.cookie.match(new RegExp("(?:^|; )" + name.replace(/([.$?*|{}()\[\]\\\/\+^])/g, "\\$1") + "=([^;]*)"));
    return match ? decodeURIComponent(match[1]) : undefined;
  };

  useEffect(() => {
    const read = () => {
      const stream = getCookie("desktop_stream");
      if (stream && stream !== src) setSrc(stream);
    };
    read();
    const id = setInterval(read, 1000);
    return () => clearInterval(id);
  }, [src]);

  if (!src) {
    return <div className="w-full h-full flex items-center justify-center text-sm text-muted-foreground">Desktop will appear here after starting a chat…</div>;
  }

  return <iframe src={src} className="w-full h-full" title="Sandbox Desktop" />;
}
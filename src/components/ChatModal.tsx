"use client";

import { useState } from "react";
import { useModalBack } from "@/hooks/useModalBack";
import { Send, Paperclip, Smile, Phone, Video, ShoppingBag, MapPin, Star } from "lucide-react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface Message {
  id: string;
  sender: "user" | "shop";
  content: string;
  timestamp: string;
  type: "text" | "deal" | "product";
  product?: { name: string; price: number; image: string };
}

interface ChatModalProps {
  isOpen: boolean;
  onClose: () => void;
  shopName?: string;
  shopLocation?: string;
  shopRating?: number;
}

const initialMessages: Message[] = [
  { id: "1", sender: "shop", content: "Hello! Welcome to our shop. How can I help you today?", timestamp: "10:30 AM", type: "text" },
  { id: "2", sender: "user", content: "Hi! I'm interested in the iPhone 15 Pro Max. Is it still available?", timestamp: "10:32 AM", type: "text" },
  { id: "3", sender: "shop", content: "Yes, it's available!", timestamp: "10:33 AM", type: "product", product: { name: "iPhone 15 Pro Max 256GB", price: 8500, image: "https://images.unsplash.com/photo-1592750475338-74b7b21085ab?w=200" } },
  { id: "4", sender: "shop", content: "Would you like to make a deal? I can offer you a 5% discount if you buy today!", timestamp: "10:35 AM", type: "deal" },
];

export default function ChatModal({
  isOpen,
  onClose,
  shopName = "Tech Hub Electronics",
  shopLocation = "Soweto Market",
  shopRating = 4.8,
}: ChatModalProps) {
  useModalBack(isOpen, onClose);

  const [newMessage, setNewMessage] = useState("");
  const [messages, setMessages] = useState<Message[]>(initialMessages);

  const handleSend = () => {
    if (!newMessage.trim()) return;
    setMessages([
      ...messages,
      {
        id: Date.now().toString(),
        sender: "user",
        content: newMessage,
        timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
        type: "text",
      },
    ]);
    setNewMessage("");
  };

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="sm:max-w-md h-[80vh] sm:h-[70vh] p-0 gap-0 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-3 border-b border-border shrink-0">
          <div className="flex items-center gap-2.5 min-w-0">
            <Avatar className="h-9 w-9 shrink-0">
              <AvatarFallback className="bg-gradient-to-br from-primary to-amber-golden text-primary-foreground text-xs">
                <ShoppingBag className="h-4 w-4" />
              </AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <h3 className="font-semibold text-sm truncate">{shopName}</h3>
              <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
                <MapPin className="h-2.5 w-2.5" />
                <span className="truncate">{shopLocation}</span>
                <Star className="h-2.5 w-2.5 text-yellow-400 fill-yellow-400" />
                <span>{shopRating}</span>
              </div>
            </div>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Phone className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="icon" className="h-8 w-8">
              <Video className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-3 space-y-3">
          {messages.map((message) => (
            <div
              key={message.id}
              className={cn("flex", message.sender === "user" ? "justify-end" : "justify-start")}
            >
              <div className="max-w-[80%]">
                {message.type === "text" && (
                  <div
                    className={cn(
                      "px-3 py-2 rounded-2xl text-sm",
                      message.sender === "user"
                        ? "bg-primary text-primary-foreground rounded-br-md"
                        : "bg-muted text-foreground rounded-bl-md"
                    )}
                  >
                    {message.content}
                  </div>
                )}
                {message.type === "product" && message.product && (
                  <div className="bg-muted rounded-lg p-3 border border-border">
                    <div className="flex items-center gap-2.5">
                      <div className="w-10 h-10 bg-muted-foreground/20 rounded-lg flex items-center justify-center shrink-0">
                        <ShoppingBag className="h-5 w-5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0">
                        <h4 className="text-xs font-medium truncate">{message.product.name}</h4>
                        <p className="text-sm font-semibold text-brand">K{message.product.price}</p>
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground mt-2">{message.content}</p>
                  </div>
                )}
                {message.type === "deal" && (
                  <div className="bg-primary/10 border border-primary/20 rounded-lg p-3">
                    <div className="flex items-center gap-1.5 mb-1.5">
                      <ShoppingBag className="h-3.5 w-3.5 text-brand" />
                      <span className="text-xs font-medium text-brand">Deal Offer</span>
                    </div>
                    <p className="text-xs text-foreground">{message.content}</p>
                    <Button size="sm" className="mt-2 h-7 text-xs bg-primary text-primary-foreground hover:bg-primary/90">
                      Accept Deal
                    </Button>
                  </div>
                )}
                <p className="text-[10px] text-muted-foreground mt-0.5 px-1">{message.timestamp}</p>
              </div>
            </div>
          ))}
        </div>

        {/* Input */}
        <div className="p-3 border-t border-border shrink-0">
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
              <Paperclip className="h-4 w-4" />
            </Button>
            <Input
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend();
                }
              }}
              placeholder="Type a message..."
              className="flex-1"
            />
            <Button variant="ghost" size="icon" className="h-9 w-9 shrink-0">
              <Smile className="h-4 w-4" />
            </Button>
            <Button
              size="icon"
              className="h-9 w-9 shrink-0 bg-primary text-primary-foreground hover:bg-primary/90"
              disabled={!newMessage.trim()}
              onClick={handleSend}
            >
              <Send className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

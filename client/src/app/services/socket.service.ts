import { Injectable } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { io, Socket } from 'socket.io-client';

export interface Message {
  id: any;
  username: string | null;
  avatarColor: string | null;
  content: string;
  type: 'text' | 'system';
  created_at: string;
  reactions: { emoji: string; count: number; users: string[] }[];
}

export interface OnlineUser {
  userId: any;
  username: string;
  avatarColor: string;
}

@Injectable({ providedIn: 'root' })
export class SocketService {

  private socket: Socket | null = null;

  // Streams that components can subscribe to
  message$  = new Subject<Message>();
  users$    = new BehaviorSubject<OnlineUser[]>([]);
  typing$   = new BehaviorSubject<string[]>([]);
  reaction$ = new Subject<{ messageId: any; reactions: any[] }>();
  connected$ = new BehaviorSubject<boolean>(false);

  connect(token: string): void {
    // Use current page origin so it works on any device, not just localhost
    this.socket = io(window.location.origin, {
      auth: { token }
    });

    this.socket.on('connect',    () => this.connected$.next(true));
    this.socket.on('disconnect', () => this.connected$.next(false));

    this.socket.on('init', (data: { users: OnlineUser[]; typing: string[]; serverId: string }) => {
      this.users$.next(data.users);
      this.typing$.next(data.typing);

      const storedId = localStorage.getItem('server_id');
      if (storedId && storedId !== data.serverId) {
      // Server restarted — clear localStorage & logout
        const authUser = localStorage.getItem('chat_user');
        localStorage.clear();
      }
      localStorage.setItem('server_id', data.serverId);
    });

    this.socket.on('message:new',   (msg: Message)                         => this.message$.next(msg));
    this.socket.on('users:update',  (users: OnlineUser[])                  => this.users$.next(users));
    this.socket.on('typing:update', (names: string[])                      => this.typing$.next(names));
    this.socket.on('reaction:update', (data: { messageId: any; reactions: any[] }) => this.reaction$.next(data));
  }

  disconnect(): void {
    this.socket?.disconnect();
    this.socket = null;
  }

  sendMessage(content: string): void {
    this.socket?.emit('message:send', { content });
  }

  startTyping(): void {
    this.socket?.emit('typing:start');
  }

  stopTyping(): void {
    this.socket?.emit('typing:stop');
  }

  toggleReaction(messageId: any, emoji: string): void {
    this.socket?.emit('reaction:toggle', { messageId, emoji });
  }
}

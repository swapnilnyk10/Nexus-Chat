import { Component, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked } from '@angular/core';
import { Subscription } from 'rxjs';
import { AuthService } from '../../services/auth.service';
import { SocketService, Message, OnlineUser } from '../../services/socket.service';
import { HttpClient, HttpHeaders } from '@angular/common/http';

const EMOJIS = ['👍', '❤️', '😂', '😮', '😢', '🔥', '👏', '🎉'];

@Component({
  selector: 'app-chat',
  templateUrl: './chat.component.html',
  styleUrls: ['./chat.component.scss']
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {

  @ViewChild('messageList') messageListEl!: ElementRef<HTMLElement>;

  messages:     Message[]    = [];
  onlineUsers:  OnlineUser[] = [];
  typingUsers:  string[]     = [];
  messageText   = '';
  loading       = true;
  isConnected   = false;
  sidebarOpen   = false;
  reactionPickerFor: any = null; // message id of open picker, or null
  isTyping:Boolean = false
  readonly emojis = EMOJIS;

  private subscriptions = new Subscription();
  private typingTimer: any = null; // timer to auto-stop typing

  constructor(
    public  auth: AuthService,
    private socket: SocketService,
    private http: HttpClient
  ) {}

  ngOnInit(): void {
    // Load message history from REST API
    const headers = new HttpHeaders({ Authorization: `Bearer ${this.auth.token}` });
    this.http.get<Message[]>('/api/messages', { headers }).subscribe({
      next: (msgs) => { this.messages = msgs; this.loading = false; },
      error: ()    => { this.loading = false; }
    });

    
    // Connect to WebSocket
    this.socket.connect(this.auth.token!);

    // Subscribe to all socket events
    this.subscriptions.add(this.socket.connected$.subscribe(v => this.isConnected = v));
    this.subscriptions.add(this.socket.message$.subscribe(msg => this.messages.push(msg)));
    this.subscriptions.add(this.socket.users$.subscribe(users => this.onlineUsers = users));
    this.subscriptions.add(this.socket.typing$.subscribe(names => {
      // Don't show current user in typing list
      this.typingUsers = names.filter(n => n !== this.auth.currentUser?.username);
    }));
    this.subscriptions.add(this.socket.reaction$.subscribe(data => {
      const msg = this.messages.find(m => m.id == data.messageId);
      if (msg) msg.reactions = data.reactions;
    }));
  }

  ngAfterViewChecked(): void {
    // Keep scroll pinned to the bottom
    const el = this.messageListEl?.nativeElement;
    if (el) el.scrollTop = el.scrollHeight;
  }

  ngOnDestroy(): void {
    this.subscriptions.unsubscribe();
    this.socket.disconnect();
  }

  // Send message on Enter (Shift+Enter adds a new line)
  onKeyDown(e: KeyboardEvent): void {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      this.sendMessage();
    }
  }

  // Emit typing events while user is typing, stop after 3s of silence
  onInput(): void {
    if(!this.isTyping){
      this.isTyping = true;
      this.socket.startTyping();       
    }
    clearTimeout(this.typingTimer);
    this.typingTimer = setTimeout(() => {
      this.isTyping = false;
      this.socket.stopTyping();
    }, 3000);
  }

  sendMessage(): void {
    const content = this.messageText.trim();
    if (!content) return;

    this.socket.sendMessage(content);
    this.messageText = '';
    this.isTyping = false;
    this.socket.stopTyping();
    clearTimeout(this.typingTimer);
  }

  addReaction(msgId: any, emoji: string): void {
    this.socket.toggleReaction(msgId, emoji);
    this.reactionPickerFor = null;
  }

  togglePicker(msgId: any, e: Event): void {
    e.stopPropagation();
    this.reactionPickerFor = this.reactionPickerFor === msgId ? null : msgId;
  }

  closePicker(): void {
    this.reactionPickerFor = null;
  }

  logout(): void {
    this.socket.disconnect();
    this.auth.logout();
  }

  // ── Template helpers ────────────────────────────────────────────────────────

  isOwn(msg: Message): boolean {
    return msg.username === this.auth.currentUser?.username;
  }

  initial(name: string | null): string {
    return name ? name[0].toUpperCase() : '?';
  }

  formatTime(dateStr: string): string {
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  hasReacted(reaction: any): boolean {
    return reaction.users?.includes(this.auth.currentUser?.username);
  }

  getTypingText(): string {
    if (this.typingUsers.length === 0) return '';
    if (this.typingUsers.length === 1) return `${this.typingUsers[0]} is typing...`;
    return `${this.typingUsers.join(', ')} are typing...`;
  }
}

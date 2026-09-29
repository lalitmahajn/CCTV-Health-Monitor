import React, { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '../ui/card';
import { Input } from '../ui/input';
import { Button } from '../ui/button';
import { Badge } from '../ui/badge';
import { ShieldCheck, Lock, User, Eye, EyeOff, Loader2, AlertCircle, Video } from 'lucide-react';

export const LoginView: React.FC = () => {
  const { login } = useAuth();
  const [username, setUsername] = useState('admin');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!username.trim() || !password.trim()) {
      setError('Please provide both username and password');
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message || 'Invalid username or password');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen w-full flex items-center justify-center p-4 bg-gradient-to-br from-background via-muted/30 to-background selection:bg-primary/20">
      {/* Background ambient pattern */}
      <div className="absolute inset-0 bg-grid-pattern opacity-5 pointer-events-none" />

      <div className="w-full max-w-md relative z-10 animate-in fade-in-50 zoom-in-95 duration-300">
        <Card className="border-border/60 shadow-2xl shadow-primary/5 bg-card/95 backdrop-blur">
          <CardHeader className="space-y-3 text-center pb-6">
            <div className="mx-auto w-14 h-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shadow-inner">
              <Video className="w-7 h-7" />
            </div>
            <div>
              <CardTitle className="text-xl font-bold tracking-tight">
                CCTV Health Monitor
              </CardTitle>
              <CardDescription className="text-xs text-muted-foreground mt-1">
                Enterprise Fleet Command & Live Surveillance Diagnostic Platform
              </CardDescription>
            </div>
            <div className="flex justify-center">
              <Badge variant="outline" className="text-[11px] gap-1 px-2.5 py-0.5 font-mono text-muted-foreground border-border/80">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-500" />
                Single Gatekeeper • AES-256 Protected
              </Badge>
            </div>
          </CardHeader>

          <form onSubmit={handleSubmit}>
            <CardContent className="space-y-4">
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/30 text-destructive text-xs flex items-center gap-2.5 animate-in fade-in">
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  <span>{error}</span>
                </div>
              )}

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <User className="w-3.5 h-3.5" />
                  Username
                </label>
                <div className="relative">
                  <Input
                    type="text"
                    placeholder="Enter admin username"
                    value={username}
                    onChange={(e) => setUsername(e.target.value)}
                    disabled={isSubmitting}
                    autoFocus
                    required
                    className="h-10 text-sm font-medium pl-3 bg-background"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5" />
                  Password
                </label>
                <div className="relative">
                  <Input
                    type={showPassword ? 'text' : 'password'}
                    placeholder="Enter admin password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    disabled={isSubmitting}
                    required
                    className="h-10 text-sm font-mono pr-10 pl-3 bg-background"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    tabIndex={-1}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors p-1"
                  >
                    {showPassword ? (
                      <EyeOff className="w-4 h-4" />
                    ) : (
                      <Eye className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </div>
            </CardContent>

            <CardFooter className="flex flex-col gap-3 pt-2 pb-6">
              <Button
                type="submit"
                disabled={isSubmitting}
                className="w-full h-10 font-semibold gap-2 transition-all shadow-md shadow-primary/10"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="w-4 h-4 animate-spin" />
                    Authenticating...
                  </>
                ) : (
                  <>
                    <Lock className="w-4 h-4" />
                    Sign In to Fleet Command
                  </>
                )}
              </Button>
              <p className="text-[11px] text-center text-muted-foreground">
                Default: <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px]">admin</code> / <code className="bg-muted px-1.5 py-0.5 rounded font-mono text-[10px]">admin123</code>
              </p>
            </CardFooter>
          </form>
        </Card>
      </div>
    </div>
  );
};

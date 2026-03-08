import type { TaskRecord } from '../api';
import { Boxes, Link2 } from 'lucide-react';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { EmptyState } from '@/components/ui/empty-state';
import { StatusBadge } from '@/components/ui/status-badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

function formatTimestamp(value: string): string {
  return new Date(value).toLocaleString();
}

export function TasksPanel({ tasks }: { tasks: TaskRecord[] }) {
  return (
    <Card id="tasks">
      <CardHeader>
        <p className="text-muted-foreground text-xs font-medium uppercase tracking-[0.16em]">Tasks</p>
        <CardTitle>Task group watchlist</CardTitle>
        <CardDescription>Grouped sessions, owner source metadata, and current task lifecycle all in one place.</CardDescription>
      </CardHeader>

      <CardContent>
        {tasks.length === 0 ? (
          <EmptyState
            title="No task groups recorded yet"
            description="Grouped work will appear here once multiple sessions are tied together by the daemon."
            icon={<Boxes className="size-5" />}
          />
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Task group</TableHead>
                <TableHead>Owner</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Sessions</TableHead>
                <TableHead>Updated</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {tasks.map((task) => (
                <TableRow key={task.id}>
                  <TableCell className="align-top">
                    <div className="space-y-1">
                      <p className="font-medium">{task.title}</p>
                      <p className="text-muted-foreground flex items-center gap-1.5 text-xs">
                        <Link2 className="size-3.5" />
                        {task.source}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-muted-foreground">{task.ownerPrincipal}</TableCell>
                  <TableCell>
                    <StatusBadge value={task.status} />
                  </TableCell>
                  <TableCell>{task.sessionCount}</TableCell>
                  <TableCell className="text-muted-foreground">{formatTimestamp(task.updatedAt)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  );
}

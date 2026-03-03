import { TestBed } from "@angular/core/testing";
import { NotificationsService } from "./notifications.service";

describe("NotificationsService", () => {
  let service: NotificationsService;

  beforeEach(() => {
    TestBed.configureTestingModule({});
    service = TestBed.inject(NotificationsService);
  });

  it("should be created", () => {
    expect(service).toBeTruthy();
  });

  it("unreadCount() should match the number of unread notifications", () => {
    const expected = service.notifications().filter((n) => !n.read).length;
    expect(service.unreadCount()).toBe(expected);
  });

  it("markAsRead() should mark the given notification as read", () => {
    const unread = service.notifications().find((n) => !n.read);
    if (!unread) return pending("No hay notificaciones sin leer en el fixture");

    service.markAsRead(unread.id);
    const updated = service.notifications().find((n) => n.id === unread.id);
    expect(updated?.read).toBeTrue();
  });

  it("markAsRead() should decrement unreadCount by 1", () => {
    const unread = service.notifications().find((n) => !n.read);
    if (!unread) return pending("No hay notificaciones sin leer en el fixture");

    const before = service.unreadCount();
    service.markAsRead(unread.id);
    expect(service.unreadCount()).toBe(before - 1);
  });

  it("markAllAsRead() should set unreadCount to 0", () => {
    service.markAllAsRead();
    expect(service.unreadCount()).toBe(0);
  });

  it("markAllAsRead() should mark every notification as read", () => {
    service.markAllAsRead();
    service.notifications().forEach((n) => {
      expect(n.read).toBeTrue();
    });
  });

  it("filter should default to 'all'", () => {
    expect(service.filter()).toBe("all");
  });

  it("setFilter() should update the filter signal", () => {
    service.setFilter("unread");
    expect(service.filter()).toBe("unread");
  });

  it("filteredNotifications() with 'unread' should contain only unread items", () => {
    service.setFilter("unread");
    service.filteredNotifications().forEach((n) => {
      expect(n.read).toBeFalse();
    });
  });

  it("filteredNotifications() with 'all' should return all notifications sorted newest-first", () => {
    service.setFilter("all");
    const list = service.filteredNotifications();
    expect(list.length).toBe(service.notifications().length);
    for (let i = 1; i < list.length; i++) {
      expect(list[i - 1].createdAt.getTime()).toBeGreaterThanOrEqual(
        list[i].createdAt.getTime(),
      );
    }
  });

  it("filteredNotifications() with type 'info' should return only info-type items", () => {
    service.setFilter("info");
    service.filteredNotifications().forEach((n) => {
      expect(n.type ?? "info").toBe("info");
    });
  });

  it("panelNotifications() should cap at 15 items", () => {
    expect(service.panelNotifications().length).toBeLessThanOrEqual(15);
  });
});

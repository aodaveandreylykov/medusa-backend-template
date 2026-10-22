import { defineRouteConfig } from "@medusajs/admin-sdk"
import { EnvelopeSolid } from "@medusajs/icons"
import { Badge, Button, Container, Heading, Table, Text, toast } from "@medusajs/ui"
import { useEffect, useState } from "react"

type Contact = {
  id: string
  name: string
  email: string
  message: string
  created_at: string
}

export const config = defineRouteConfig({
  label: "Заявки",
  icon: EnvelopeSolid,
})

export default function ContactsPage() {
  const [contacts, setContacts] = useState<Contact[]>([])
  const [loading, setLoading] = useState(true)
  const [deleting, setDeleting] = useState<string | null>(null)
  const [expanded, setExpanded] = useState<string | null>(null)

  async function load() {
    setLoading(true)
    try {
      const res = await fetch("/admin/contacts", { credentials: "include" })
      const data = await res.json()
      setContacts(data.contacts ?? [])
    } catch {
      toast.error("Не удалось загрузить заявки")
    } finally {
      setLoading(false)
    }
  }

  async function remove(id: string) {
    setDeleting(id)
    try {
      await fetch("/admin/contacts", {
        method: "DELETE",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id }),
      })
      setContacts((prev) => prev.filter((c) => c.id !== id))
      toast.success("Заявка удалена")
    } catch {
      toast.error("Ошибка при удалении")
    } finally {
      setDeleting(null)
    }
  }

  useEffect(() => {
    load()
  }, [])

  function formatDate(iso: string) {
    return new Date(iso).toLocaleString("ru-RU", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    })
  }

  return (
    <div className="flex flex-col gap-y-4 p-6">
      <div className="flex items-center justify-between">
        <div>
          <Heading level="h1">Заявки с сайта</Heading>
          <Text className="text-ui-fg-subtle" size="small">
            Сообщения из формы «Get in Touch»
          </Text>
        </div>
        <div className="flex items-center gap-x-2">
          <Badge color="blue" rounded="full">
            {contacts.length}
          </Badge>
          <Button variant="secondary" size="small" onClick={load} disabled={loading}>
            Обновить
          </Button>
        </div>
      </div>

      <Container>
        {loading ? (
          <div className="flex items-center justify-center py-16">
            <Text className="text-ui-fg-subtle">Загрузка…</Text>
          </div>
        ) : contacts.length === 0 ? (
          <div className="flex flex-col items-center justify-center gap-y-2 py-16">
            <Text className="text-ui-fg-subtle">Заявок пока нет</Text>
          </div>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>Дата</Table.HeaderCell>
                <Table.HeaderCell>Имя</Table.HeaderCell>
                <Table.HeaderCell>Email</Table.HeaderCell>
                <Table.HeaderCell>Сообщение</Table.HeaderCell>
                <Table.HeaderCell></Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {contacts.map((c) => (
                <>
                  <Table.Row
                    key={c.id}
                    className="cursor-pointer"
                    onClick={() => setExpanded(expanded === c.id ? null : c.id)}
                  >
                    <Table.Cell>
                      <Text size="small" className="text-ui-fg-subtle whitespace-nowrap">
                        {formatDate(c.created_at)}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Text size="small" className="font-medium">
                        {c.name}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <a
                        href={`mailto:${c.email}`}
                        className="text-ui-fg-interactive text-sm hover:underline"
                        onClick={(e) => e.stopPropagation()}
                      >
                        {c.email}
                      </a>
                    </Table.Cell>
                    <Table.Cell>
                      <Text
                        size="small"
                        className="text-ui-fg-subtle max-w-xs truncate"
                      >
                        {c.message}
                      </Text>
                    </Table.Cell>
                    <Table.Cell>
                      <Button
                        variant="danger"
                        size="small"
                        isLoading={deleting === c.id}
                        onClick={(e) => {
                          e.stopPropagation()
                          remove(c.id)
                        }}
                      >
                        Удалить
                      </Button>
                    </Table.Cell>
                  </Table.Row>
                  {expanded === c.id && (
                    <Table.Row key={`${c.id}-expanded`}>
                      <Table.Cell colSpan={5}>
                        <div className="bg-ui-bg-subtle rounded-lg p-4 my-1">
                          <Text size="small" className="text-ui-fg-base whitespace-pre-wrap">
                            {c.message}
                          </Text>
                        </div>
                      </Table.Cell>
                    </Table.Row>
                  )}
                </>
              ))}
            </Table.Body>
          </Table>
        )}
      </Container>
    </div>
  )
}

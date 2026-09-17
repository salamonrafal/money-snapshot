# Wskazówki dla agentów

- Klasy zarządzane przez Spring powinny mieć jeden konstruktor produkcyjny.
- Nie dodawaj dodatkowych konstruktorów do beanów tylko na potrzeby testów. Zamiast tego używaj fabryk testowych, konfiguracji testowej albo jednoznacznie oznacz konstruktor produkcyjny `@Autowired`.
- Po zmianie konstruktorów uruchom test startu kontekstu Spring oraz `mvn test`.

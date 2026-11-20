export default class Desk {
    public Id: string;
    public Name: string;
    public Assignee: string;
    public Status: string;
    public LastError: string;
    public MovesToday: number;

    constructor(id: string, name: string, assignee: string, status: string, last_error: string, moves_today: number) {
        this.Id = id;
        this.Name = name;
        this.Assignee = assignee;
        this.Status = status;
        this.LastError = last_error;
        this.MovesToday = moves_today
    }
}
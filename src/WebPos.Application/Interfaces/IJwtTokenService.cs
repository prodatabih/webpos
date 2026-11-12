using WebPos.Domain.Entities;

namespace WebPos.Application.Interfaces;

public interface IJwtTokenService
{
    string GenerateToken(User user);
}

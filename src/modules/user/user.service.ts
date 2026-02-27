import { Injectable, NotFoundException, ConflictException } from '@nestjs/common';
import { User } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { UserRepository } from './user.repository';
import { EventBusService } from '../../core/events/event-bus.service';
import { MultiTierCacheService } from '../../core/cache/multi-tier-cache.service';
import { Cacheable } from '../../core/cache/cache.decorator';
import { CreateUserDto } from './dto/create-user.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { UserCreatedEvent } from './events/user-created.event';
import { UserUpdatedEvent } from './events/user-updated.event';
import { UserDeletedEvent } from './events/user-deleted.event';
import { PaginationParams, PaginatedResult } from '../../core/database/interfaces/repository.interface';

@Injectable()
export class UserService {
  private readonly CACHE_TTL = 3600; // 1 hour
  private readonly CACHE_NAMESPACE = 'user';

  constructor(
    private readonly userRepository: UserRepository,
    private readonly eventBus: EventBusService,
    private readonly cacheService: MultiTierCacheService,
  ) {}

  @Cacheable({
    key: 'user:{{id}}',
    ttl: 3600,
  })
  async findById(id: string): Promise<User> {
    const user = await this.userRepository.findById(id);
    if (!user || user.deletedAt) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }
    return user;
  }

  @Cacheable({
    key: 'user:email:{{email}}',
    ttl: 3600,
  })
  async findByEmail(email: string): Promise<User | null> {
    return this.userRepository.findByEmail(email);
  }

  async findAll(params: PaginationParams): Promise<PaginatedResult<User>> {
    return this.userRepository.paginate(params);
  }

  async create(createUserDto: CreateUserDto): Promise<User> {
    // Check if user already exists
    const existingUser = await this.userRepository.findByEmail(createUserDto.email);
    if (existingUser) {
      throw new ConflictException(`User with email ${createUserDto.email} already exists`);
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(createUserDto.password, 10);

    // Create user
    const user = await this.userRepository.create({
      email: createUserDto.email,
      password: hashedPassword,
      firstName: createUserDto.firstName,
      lastName: createUserDto.lastName,
      tenantId: createUserDto.tenantId,
    });

    // Emit domain event
    await this.eventBus.publish(
      new UserCreatedEvent(
        user.id,
        user.email,
        user.firstName,
        user.lastName,
        user.tenantId,
      ),
    );

    // Cache the new user
    await this.cacheUser(user);

    return user;
  }

  async update(id: string, updateUserDto: UpdateUserDto): Promise<User> {
    // Check if user exists
    const existingUser = await this.userRepository.findById(id);
    if (!existingUser || existingUser.deletedAt) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // If email is being updated, check for conflicts
    if (updateUserDto.email && updateUserDto.email !== existingUser.email) {
      const emailExists = await this.userRepository.findByEmail(updateUserDto.email);
      if (emailExists) {
        throw new ConflictException(`User with email ${updateUserDto.email} already exists`);
      }
    }

    // Update user
    const updatedUser = await this.userRepository.update(id, updateUserDto);

    // Emit domain event
    await this.eventBus.publish(
      new UserUpdatedEvent(id, updateUserDto),
    );

    // Invalidate cache
    await this.invalidateUserCache(existingUser);
    await this.cacheUser(updatedUser);

    return updatedUser;
  }

  async delete(id: string): Promise<void> {
    const user = await this.userRepository.findById(id);
    if (!user || user.deletedAt) {
      throw new NotFoundException(`User with ID ${id} not found`);
    }

    // Soft delete
    await this.userRepository.softDelete(id);

    // Emit domain event
    await this.eventBus.publish(
      new UserDeletedEvent(id, user.email),
    );

    // Invalidate cache
    await this.invalidateUserCache(user);
  }

  private async cacheUser(user: User): Promise<void> {
    await this.cacheService.set(
      `${this.CACHE_NAMESPACE}:${user.id}`,
      user,
      this.CACHE_TTL,
    );
    await this.cacheService.set(
      `${this.CACHE_NAMESPACE}:email:${user.email}`,
      user,
      this.CACHE_TTL,
    );
  }

  private async invalidateUserCache(user: User): Promise<void> {
    await this.cacheService.del(`${this.CACHE_NAMESPACE}:${user.id}`);
    await this.cacheService.del(`${this.CACHE_NAMESPACE}:email:${user.email}`);
  }
}
